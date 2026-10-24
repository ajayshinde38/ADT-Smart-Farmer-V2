import logging
from pathlib import Path
from typing import Dict, Any, Optional
import io

logger = logging.getLogger(__name__)

UNET_CLASSES = {0: "Background", 1: "Brown Rust", 2: "Mosaic", 3: "Red Rot"}
_model = None
_model_loaded = False


def load_unet_model(weights_path: Optional[str] = None):
    """
    Safely load PyTorch ResNet34 UNet model weights for sugarcane disease segmentation.
    Runs on CPU to keep memory within one-process constraints.
    """
    global _model, _model_loaded
    if _model_loaded:
        return _model

    try:
        import torch
        import segmentation_models_pytorch as smp
        
        model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,
            in_channels=3,
            classes=4,
            activation=None
        )
        
        target_path = Path(weights_path) if weights_path else Path(__file__).parent / "models" / "best_unet.pth"
        if target_path.exists():
            state = torch.load(str(target_path), map_location="cpu", weights_only=True)
            model.load_state_dict(state)
            logger.info(f"Loaded UNet weights from {target_path}")
        else:
            raise FileNotFoundError('Trained model weights are unavailable')
            
        model.eval()
        _model = model
        _model_loaded = True
        return _model
    except Exception as e:
        logger.warning(f"Could not initialize PyTorch UNet model: {e}")
        _model = None
        _model_loaded = False
        return None


def run_inference(image_bytes: bytes) -> Dict[str, Any]:
    """
    Execute image segmentation inference on crop leaf photo.
    Returns detected disease name, confidence score, and affected area percentage.
    """
    model = load_unet_model()
    if model is None:
        raise RuntimeError('The trained scan model is unavailable. Please try again later.')

    try:
        import torch
        import numpy as np
        from PIL import Image
        from torchvision import transforms

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        transform = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        input_tensor = transform(image).unsqueeze(0)  # Shape [1, 3, 256, 256]

        with torch.no_grad():
            output = model(input_tensor)
            probs = torch.softmax(output, dim=1)
            confidence_map, raw_mask = torch.max(probs, dim=1)
            pred_mask = raw_mask.squeeze(0).numpy()
            pred_mask[confidence_map.squeeze(0).numpy() < 0.75] = 0

        # Class counts
        total_pixels = pred_mask.size
        class_counts = {c: int(np.sum(pred_mask == c)) for c in range(4)}

        # Find dominant disease class (ignoring background 0)
        disease_counts = {c: class_counts[c] for c in [1, 2, 3]}
        dominant_class = max(disease_counts, key=disease_counts.get)
        dominant_pixels = disease_counts[dominant_class]

        affected_pct = round((dominant_pixels / total_pixels) * 100, 1)

        if affected_pct < 2.0:
            return {
                'disease': 'No supported disease detected',
                'confidence': round(float(probs[0, 0].mean().item()), 2),
                'affected_percent': 0.0, 'severity': 'None', 'status': 'not_detected',
                'overlay_data_url': None,
            }

        disease_name = UNET_CLASSES.get(dominant_class, "Brown Rust")
        severity = "High" if affected_pct > 30 else ("Medium" if affected_pct > 10 else "Low")

        import base64
        pixels = np.asarray(image.resize((256, 256))).copy()
        palette = {1: [245, 128, 40], 2: [240, 210, 30], 3: [220, 50, 60]}
        for category, color in palette.items():
            selected = pred_mask == category
            pixels[selected] = (pixels[selected] * 0.5 + np.array(color) * 0.5).astype(np.uint8)
        overlay_buffer = io.BytesIO()
        Image.fromarray(pixels).save(overlay_buffer, format='PNG')
        overlay = 'data:image/png;base64,' + base64.b64encode(overlay_buffer.getvalue()).decode('ascii')
        return {
            'status': 'disease_detected', 'overlay_data_url': overlay,
            "disease": disease_name,
            "confidence": round(float(probs[0, dominant_class].numpy()[pred_mask == dominant_class].mean()), 2),
            "affected_percent": affected_pct,
            "severity": severity
        }
    except Exception as e:
        logger.error('Scan inference failed: %s', type(e).__name__)
        raise RuntimeError('The image could not be analysed. Try a clear, close photo.') from e
