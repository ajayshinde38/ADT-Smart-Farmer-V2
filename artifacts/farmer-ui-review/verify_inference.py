import io,json,time,sys,threading
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'backend'))
import psutil
from PIL import Image
from app.modules.pest_disease.service import diagnose_leaf_image
process=psutil.Process(); peak=[process.memory_info().rss]; stop=threading.Event()
def sample():
 while not stop.wait(.02): peak[0]=max(peak[0],process.memory_info().rss)
threading.Thread(target=sample,daemon=True).start()
image=Image.new('RGB',(256,256),(60,110,45)); buf=io.BytesIO(); image.save(buf,format='JPEG')
start=time.monotonic()
try:
 result=diagnose_leaf_image(buf.getvalue())
 output={'test':'synthetic transport/model smoke; not diagnostic accuracy','status':result.status,'elapsed_seconds':round(time.monotonic()-start,2),'peak_rss_mib':round(peak[0]/1048576,1)}
except Exception as e: output={'error_type':type(e).__name__}
finally: stop.set()
Path(__file__).with_name('inference-validation.json').write_text(json.dumps(output,indent=2));print(json.dumps(output))
