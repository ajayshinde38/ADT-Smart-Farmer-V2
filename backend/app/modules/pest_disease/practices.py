from typing import Dict, Any, List
from app.modules.pest_disease.schemas import DiseaseDetail, ChemicalProduct

DISEASE_CATALOG: Dict[str, DiseaseDetail] = {
    "Brown Rust": DiseaseDetail(
        disease_name="Brown Rust",
        marathi_name="तांबेरा (ब्राऊन रस्ट)",
        pathogen="Puccinia melanocephala",
        severity="Medium to High",
        symptoms="Small, elongated yellowish spots on both leaf surfaces that turn into reddish-brown elongated pustules erupting through the epidermis.",
        symptoms_mr="पानांच्या दोन्ही बाजूंवर लहान, पिवळसर डाग पडतात जे नंतर तांबूस-तपकिरी रंगाच्या लांबट पुटकुळ्यांमध्ये रूपांतरित होतात.",
        causes="High relative humidity (>85%), moderate temperatures (20-30°C), dense foliage, and susceptible sugarcane varieties.",
        causes_mr="हवेतील जास्त आर्द्रता (>८५%), २०-३०° से तापमान, दाट लागवड आणि संवेदनशील वाण.",
        prevention="Plant resistant varieties (e.g. Co 86032), maintain recommended row spacing (4-5 ft) for air circulation, avoid excess nitrogen.",
        prevention_mr="प्रतिकारक वाणांची लागवड करा (उदा. को ८६०३२), हवा खेळती राहण्यासाठी योग्य अंतर (४-५ फूट) ठेवा, अतिरिक्त नत्राचा वापर टाळा.",
        chemical_control="Spray Mancozeb 75% WP @ 2.5 g/L or Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1.0 ml/L at first appearance.",
        chemical_control_mr="रोगाची सुरुवातीची लक्षणे दिसताच मॅन्कोझेब ७५% WP (२.५ ग्रॅम/लिटर) किंवा ॲझॉक्सीस्ट्रोबिन + डायफेनोकोनॅझोल (१ मिली/लिटर) फवारावे.",
        recommended_products=[
            ChemicalProduct(
                product_name="Amistar Top",
                active_ingredient="Azoxystrobin 18.2% + Difenoconazole 11.4% SC",
                dose_per_acre="200 ml in 200 L water"
            ),
            ChemicalProduct(
                product_name="Dithane M-45",
                active_ingredient="Mancozeb 75% WP",
                dose_per_acre="600-800 g in 200 L water"
            )
        ]
    ),
    "Mosaic": DiseaseDetail(
        disease_name="Mosaic",
        marathi_name="मोझॅक (केवडा)",
        pathogen="Sugarcane Mosaic Virus (SCMV)",
        severity="High (Systemic)",
        symptoms="Contrasting pattern of normal dark green and elongated chlorotic pale-green or yellowish patches on younger leaves.",
        symptoms_mr="कोवळ्या पानांवर गर्द हिरव्या आणि फिकट पिवळसर पट्ट्यांचे अनियमित ठिपके/नक्षीदार चट्टे दिसतात.",
        causes="Aphid vectors (Rhopalosiphum maidis), infected seed setts, mechanical transmission through harvesting tools.",
        causes_mr="मावा (ॲफिड) किडींचा प्रादुर्भाव, रोगट बेणे आणि अस्वच्छ कापणी अवजारे.",
        prevention="Use virus-free certified seed setts, rogue out infected stools immediately upon detection, control aphid populations early.",
        prevention_mr="प्रमाणित निरोगी बेण्याचा वापर करा, बाधित बेटे मुळासकट उपटून नष्ट करा, मावा किडीचे वेळेवर नियंत्रण करा.",
        chemical_control="No direct virucide exists. Control aphid vectors using Imidacloprid 17.8% SL @ 0.3 ml/L or Thiamethoxam 25% WG @ 0.2 g/L.",
        chemical_control_mr="व्हायरसवर थेट रासायनिक औषध नाही. वाहक मावा किडींच्या नियंत्रणासाठी इमिडाक्लोप्रिड १७.८% SL (०.३ मिली/लिटर) किंवा थायामेथोक्साम २५% WG (०.२ ग्रॅम/लिटर) फवारावे.",
        recommended_products=[
            ChemicalProduct(
                product_name="Confidor",
                active_ingredient="Imidacloprid 17.8% SL",
                dose_per_acre="60-80 ml in 200 L water"
            ),
            ChemicalProduct(
                product_name="Actara",
                active_ingredient="Thiamethoxam 25% WG",
                dose_per_acre="40-50 g in 200 L water"
            )
        ]
    ),
    "Red Rot": DiseaseDetail(
        disease_name="Red Rot",
        marathi_name="तांबोरा / लाल कूज (रेड रॉट)",
        pathogen="Colletotrichum falcatum",
        severity="Critical",
        symptoms="Third or fourth leaf from top yellows and withers, stalk internally discolored blood-red with distinct white horizontal patches, sour alcohol smell.",
        symptoms_mr="वरतून तिसरे किंवा चौथे पान पिवळे पडून सुकते. ऊसाचा आतील भाग लाल रंगाचा होतो व त्यावर आडवे पांढरे पट्टे दिसतात, उसाला आंबट वास येतो.",
        causes="Waterlogged poorly drained soils, infected setts, wounds created by root borer or stalk borers.",
        causes_mr="पाण्याचा निचरा न होणारी जमीन, रोगट बेणे, खोडकिडीने केलेल्या जखमा.",
        prevention="Strict sett treatment with Carbendazim 50% WP (1 g/L) before planting, practice crop rotation, improve field drainage.",
        prevention_mr="लागवडीपूर्वी कार्बेन्डाझिम ५०% WP (१ ग्रॅम/लिटर) द्रावणात बेणे प्रक्रिया करा, पिकांची फेरपालट करा, शेतातील पाण्याचा निचरा सुधारा.",
        chemical_control="Sett dip in Carbendazim 50% WP @ 1 g/L for 15 minutes before planting. Drench root zone with Thiophanate Methyl 70% WP @ 1.5 g/L if early symptoms appear.",
        chemical_control_mr="लागवडीपूर्वी बेणे कार्बेन्डाझिम ५०% WP (१ ग्रॅम/लिटर) मध्ये १५ मिनिटे बुडवावे. शेतात लक्षणे दिसताच थायोफॅनेट मिथाईल ७०% WP (१.५ ग्रॅम/लिटर) आळवणी करावी.",
        recommended_products=[
            ChemicalProduct(
                product_name="Bavistin",
                active_ingredient="Carbendazim 50% WP",
                dose_per_acre="500 g sett treatment"
            ),
            ChemicalProduct(
                product_name="Roko",
                active_ingredient="Thiophanate Methyl 70% WP",
                dose_per_acre="300-400 g in 200 L water"
            )
        ]
    )
}
