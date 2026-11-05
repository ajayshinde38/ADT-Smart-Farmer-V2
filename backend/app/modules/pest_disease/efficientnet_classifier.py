"""CPU inference using the checkpoint's own labels, size and multi-label flag."""
import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
_model = None
_metadata = None
THRESHOLD = .60  # Operational review threshold, not a calibrated diagnostic probability.


def load_classifier():
    global _model, _metadata
    if _model is not None: return _model, _metadata
    try:
        import torch
        from torchvision.models import efficientnet_b0
        path = Path(__file__).with_name('models') / 'best_sugarcane_efficientnetb0.pth'
        checkpoint = torch.load(path, map_location='cpu', weights_only=True, mmap=True)
        classes = checkpoint['class_names']
        if classes != ['Brown Rust', 'Mosaic', 'Red Rot'] or checkpoint['multi_label'] is not True:
            raise ValueError('Unsupported classifier metadata')
        size = int(checkpoint['img_size'])
        if not 32 <= size <= 1024: raise ValueError('Invalid classifier image size')
        with torch.device('meta'):
            model = efficientnet_b0(weights=None)
            model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, len(classes))
        model.load_state_dict(checkpoint['model_state_dict'], strict=True, assign=True)
        model.eval()
        _metadata = {'class_names': classes, 'img_size': size, 'multi_label': True}
        _model = model
        return _model, _metadata
    except Exception as error:
        logger.error('EfficientNet initialization failed: %s', type(error).__name__)
        raise RuntimeError('The second trained scan model is unavailable. Please retry later.') from error


def run_inference(image_bytes):
    import torch
    from PIL import Image, ImageOps
    from torchvision import transforms
    model, metadata = load_classifier()
    with Image.open(io.BytesIO(image_bytes)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
    transform = transforms.Compose([
        transforms.Resize((metadata['img_size'], metadata['img_size'])), transforms.ToTensor(),
        transforms.Normalize([.485,.456,.406],[.229,.224,.225]),
    ])
    try:
        with torch.inference_mode():
            scores = torch.sigmoid(model(transform(image).unsqueeze(0)))[0]
        if scores.numel() != len(metadata['class_names']) or not torch.isfinite(scores).all():
            raise RuntimeError('Invalid classifier output')
        return {'model':'EfficientNet-B0', 'task':'multi_label_classification', 'threshold':THRESHOLD,
            'input_size':metadata['img_size'], 'status':'complete',
            'predictions':[{'disease':name,'score':round(float(score),4),'detected':float(score)>=THRESHOLD}
                for name,score in zip(metadata['class_names'],scores)]}
    except Exception as error:
        raise RuntimeError('The second model could not analyse this image. Please retry.') from error
