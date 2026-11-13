"""Reference weather suitability rules, separated from image diagnosis."""
from .rule_registry import load_approved_rules
from .prisk_engine import calculate_weather_suitability


MARATHI_RULE_NAMES = {
    'D7': 'कांडी कूज',
    'P4': 'हुमणी',
    'D2': 'तांबेरा',
    'D4': 'काणी',
    'D1': 'पोक्का बोईंग',
    'P2': 'शेंडा पोखरणारी अळी',
    'D3': 'लाल कूज',
    'P7': 'पिठ्या ढेकूण',
}

MARATHI_RULE_SYMPTOMS = {
    'D7': 'उगवण कमी किंवा विरळ होणे, अननसासारखा गोडसर आंबट वास येऊन बेणे कुजणे, आतील नसा काळ्या पडणे आणि फुटवे अशक्त निघणे किंवा न निघणे.',
    'P4': "मुळांचे नुकसान, पाने पिवळी पडून बेट सुकणे किंवा वाळणे, पिकाची वाढ खुंटणे आणि मुळांच्या कार्यक्षेत्रातील मातीत 'C' आकाराच्या पांढऱ्या हुमणी अळ्या आढळणे.",
    'D2': 'पानांवर लांबट पिवळसर-तपकिरी ठिपके तयार होऊन दोन्ही बाजूंना तांबूस-तपकिरी ते नारिंगी रंगाच्या पुटकुळ्या (बारीक फोड) येणे आणि पाने सुकणे.',
    'D4': 'शेंड्यातून किंवा वाढीच्या टोकातून काळ्या चाबकासारखा लांबट पट्टा बाहेर पडणे; पाने अरुंद व ताठ होणे, बारीक कांड्या आणि अवाजवी फुटवे फुटणे.',
    'D1': 'कोवळ्या पानांच्या तळाशी सुरकुत्या पडणे, पाने पिळवटणे, लहान राहणे व पिवळे पडणे; शेंड्याची वाढ विकृत होणे, शेंडा कुजणे व कांडीच्या आत शिडीसारखे लाल पट्टे दिसणे.',
    'P2': 'नवीन पानांवर एका ओळीत छिद्रे (शॉट होल्स), पानाच्या मुख्य शिरेत लाल रंगाची भुयारे, वाळलेला मधला पोंगा (डेड हार्ट), आणि बगलफुटी फुटून शेंडा झाडू/गुच्छ सारखा दिसणे.',
    'D3': 'वरून ३-४ क्रमांकाची पाने पिवळी पडून वाळणे, कांडी उभी चिरल्यास आतील भाग गडद लाल दिसणे व त्यावर पांढरे आडवे पट्टे आढळणे आणि अल्कोहोल/आंबलेला वास येणे.',
    'P7': 'कांड्यांच्या पेऱ्यांवर पानाच्या आवरणाखाली गुलाबी-पांढऱ्या रंगाच्या पिठ्या ढेकणांचे पुंजके, मुंग्यांचा वावर आणि कांडीच्या सालीवर पांढरा मेणासारखा थर असणे.',
}


def build_crop_watch(day, crop_stage):
    if day is None:
        return []
    # Reference rainfall thresholds have no consistent accumulation interval.
    # Do not compare a one-day forecast to an unspecified rainfall total.
    weather = {'temp_min_c': day.temp_min_c, 'temp_max_c': day.temp_max_c,
               'humidity_pct': day.humidity_pct, 'rainfall_mm': None,
               'date': str(day.date), 'source': 'open_meteo_forecast', 'is_forecast': True}
    checks = []
    for rule in load_approved_rules():
        result = calculate_weather_suitability(rule, weather, current_stage=crop_stage)
        r_id = rule['id']
        checks.append({
            'rule_id': r_id,
            'name': rule['name'],
            'name_mr': MARATHI_RULE_NAMES.get(r_id, rule['name']),
            'category': rule['category'],
            'score': result['weather_suitability_score'],
            'criteria_tested': result['criteria_tested_count'],
            'stage_eligible': result['is_stage_eligible'],
            'date': str(day.date),
            'symptoms': rule['field_symptoms'],
            'symptoms_mr': MARATHI_RULE_SYMPTOMS.get(r_id, rule['field_symptoms']),
            'evidence_grade': rule['evidence_grade'],
            'leaf_wetness_measured': False,
            'rainfall_interval_verified': False
        })
    return checks
