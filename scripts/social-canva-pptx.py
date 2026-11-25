#!/usr/bin/env python3
"""Create an editable PowerPoint source for Canva's officially supported REST import.
All visible text remains real PPTX text boxes. No credentials or customer records.
"""
import json
import hashlib
import io
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from pptx import Presentation
from PIL import Image, ImageChops, ImageStat
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt
from social_image_provider import VisualProductionError, atomic_json, prepare_sensory_artwork

ROOT=Path(__file__).resolve().parents[1]
PRESET=json.loads((ROOT/'social-editor/visual-preset.json').read_text(encoding='utf-8'))
def page_count(lesson):
    return PRESET['sensory_editorial']['pages'] if lesson.get('edition')=='sensory-v2.1' else PRESET['default_pages']

def rgb(value):
    return RGBColor.from_string(value.lstrip("#"))
def label(slide,value,left,top,width,height,size,color="#f0eee8",font="Georgia",bold=False):
    shape=slide.shapes.add_textbox(Inches(left),Inches(top),Inches(width),Inches(height))
    tf=shape.text_frame
    tf.clear()
    tf.word_wrap=True
    tf.margin_top=Inches(.03)
    tf.margin_bottom=0
    tf.margin_left=0
    tf.margin_right=0
    for index,line in enumerate(str(value).split("\n")):
        p=tf.paragraphs[0] if index==0 else tf.add_paragraph()
        p.alignment=PP_ALIGN.LEFT
        p.space_after=Pt(6)
        run=p.add_run()
        run.text=line
        run.font.name=font
        run.font.bold=bold
        run.font.size=Pt(size)
        run.font.color.rgb=rgb(color)
    return shape
def artwork_files(lesson,folder,allow_fixture=False):
    folder=Path(folder).resolve()
    file=folder / "artwork.json"
    if not file.exists():
        return None
    artwork=json.loads(file.read_text(encoding="utf-8"))
    count=page_count(lesson)
    sensory=count==7
    if artwork.get("format")!=("hana-social-artwork-v2.1" if sensory else "hana-social-artwork-v1") or artwork.get("date")!=lesson["date"] or artwork.get("title")!=lesson["title"] or not artwork.get("style"):
        raise ValueError("Artwork must match this exact lesson and date")
    visual=lesson.get("visuals",{})
    if not isinstance(visual.get("style"),str) or not visual["style"].strip():
        raise ValueError("Daily style is required; do not silently select a default medium")
    if visual["style"]!=artwork["style"]:
        raise ValueError("Artwork style must match this lesson revision")
    preset_id=PRESET['sensory_editorial']['id'] if sensory else PRESET['id']
    if visual.get("preset_id")!=preset_id or artwork.get("preset_id")!=preset_id or visual.get("layout_reference_design_id")!=PRESET['layout_reference_design_id'] or artwork.get("layout_reference_design_id")!=PRESET['layout_reference_design_id']:
        raise ValueError("Artwork and lesson must use the confirmed HANA visual preset")
    if sensory and (not lesson.get('topic_id') or lesson['topic_id']!=artwork.get('topic_id') or visual.get('palette')!=artwork.get('palette')):
        raise ValueError("Artwork must match this issue's topic and palette")
    if artwork.get("origin") not in ("new_original_artwork","test_fixture") or artwork.get("generation_mode")!="individual_images":
        raise ValueError("New independent artwork is required; no private-library reuse or grid slicing")
    fixture=artwork.get("origin")=="test_fixture"
    if fixture and not allow_fixture:
        raise ValueError("Test artwork must never be used by the daily production job")
    items=artwork.get("items") or []
    if len(items)!=count:
        raise ValueError(f"{count} independently prepared artwork files are required")
    result=[];seen=set();generation_ids=set();thumbnails=[]
    for page,item in enumerate(items,1):
        path=(folder/item["file"]).resolve()
        if not path.is_relative_to(folder) or not path.is_file() or path.stat().st_size>8*1024*1024:
            raise ValueError("Invalid or oversized artwork file")
        digest=hashlib.sha256(path.read_bytes()).hexdigest()
        if digest!=item.get("sha256") or digest in seen:
            raise ValueError("Artwork digest mismatch or repeated background")
        seen.add(digest)
        with Image.open(path) as image:
            width,height=image.size
            if sensory:
                if image.format!='PNG' or (width,height)!=(1080,1350) or item.get('page')!=page:
                    raise ValueError("Sensory artwork must be an ordered, exact 1080x1350 PNG")
                if not fixture:
                    thumb=image.convert('L').resize((32,40),Image.Resampling.LANCZOS)
                    if ImageStat.Stat(thumb).stddev[0]<7 or any(ImageStat.Stat(ImageChops.difference(thumb,prior)).mean[0]<4 for prior in thumbnails):
                        raise ValueError("Blank or near-duplicate photograph")
                    thumbnails.append(thumb)
            elif image.format not in ("PNG","JPEG","WEBP") or width<1080 or height<1350 or abs(width/height-0.8)>0.025:
                raise ValueError("Artwork must be a full resolution individual 4:5 image")
        generation_id=item.get("generation_id")
        if not isinstance(generation_id,str) or not generation_id or generation_id in generation_ids:
            raise ValueError("Artwork must come from separate image generations")
        generation_ids.add(generation_id)
        result.append(path)
    return {"files":result,"manifest":artwork,"fixture":fixture,"hashes":sorted(seen)}

def create(lesson,output,artwork=None):
    slides=lesson.get("pages") or []
    count=page_count(lesson)
    sensory=count==7
    if len(slides)!=count or not all(isinstance(x.get("title"),str) and isinstance(x.get("body"),str) for x in slides):
        raise ValueError(f"Expected exactly {count} real text pages")
    if not artwork:
        raise ValueError("No shape-only or dark placeholder deck may substitute for missing artwork")
    deck=Presentation();deck.slide_width=Inches(8);deck.slide_height=Inches(10)
    for i,part in enumerate(slides):
        slide=deck.slides.add_slide(deck.slide_layouts[6])
        slide.background.fill.solid();slide.background.fill.fore_color.rgb=rgb("#F6F3EB")
        image=str(artwork["files"][i])
        if sensory:
            with Image.open(image) as photo:
                image=io.BytesIO()
                photo.convert('RGB').save(image,format='JPEG',quality=92,optimize=True)
                image.seek(0)
        slide.shapes.add_picture(image,0,0,width=deck.slide_width,height=deck.slide_height)
        label(slide,"HANA SCENT ARTIST",.67,.40,6.6,.33,11,"#62655e",font="Arial")
        label(slide,part['section'] if sensory else "SCENT & RHYTHM" if "節奏" in lesson["title"] else "OLFACTORY NOTES",.67,.95,6.5,.3,10,"#74786c",font="Noto Sans CJK TC" if sensory else "Arial")
        label(slide,part["title"],.65,1.38,6.7,1.25,34 if i==0 else 30,"#303b38",font="Noto Serif CJK TC")
        body=part["body"]
        label(slide,body,.67,2.98 if i==0 else 2.36,6.6,1.1,17,"#45514a",font="Noto Serif CJK TC")
        label(slide,"HANA 感官誌" if sensory else "HANA 嗅覺微課 · Day "+str(lesson["day"]).zfill(3),.67,9.47,5.4,.3,10,"#5f6b60",font="Noto Sans CJK TC")
        label(slide,f"{i+1:02d} / {count:02d}",6.25,9.44,1.1,.35,12,"#45514a",font="Georgia")
    output.parent.mkdir(parents=True,exist_ok=True);deck.save(output)
    lesson["visuals"]={**lesson.get("visuals",{}),"artwork_ready":True,"image_count":count,"style":artwork["manifest"]["style"],"asset_hashes":artwork["hashes"],"pptx_sha256":hashlib.sha256(output.read_bytes()).hexdigest(),"fixture":artwork["fixture"],"layout_status":"draft_relayout","human_review":"pending","publication_authorized":False}
    return len(deck.slides)

def record_visual_stage(path,lesson,status,reason=None):
    visual=lesson['visuals']
    review_path=path.parent/'review.json'
    review=json.loads(review_path.read_text(encoding='utf-8'))
    updates={'status':status,'reason':reason,'imagesGenerated':visual['artwork_ready'] and not visual.get('fixture',False),'imageCount':visual['image_count'],'canvaCreated':False,'published':False}
    atomic_json(review_path,{**review,**updates})
    latest=path.parent.parent/'latest.json'
    if latest.exists():
        manifest=json.loads(latest.read_text(encoding='utf-8'))
        if manifest.get('date')==lesson['date'] and not manifest.get('canvaCreated'):
            atomic_json(latest,{**manifest,'reviewStatus':status,'visualReason':reason,'imagesGenerated':updates['imagesGenerated'],'imageCount':updates['imageCount']})

def main():
    date=os.getenv("LESSON_DATE") or datetime.now(ZoneInfo("Asia/Taipei")).strftime("%Y-%m-%d")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}",date):
        raise SystemExit("Invalid LESSON_DATE")
    path=ROOT / "content" / "instagram" / date / "lesson.json"
    lesson=json.loads(path.read_text(encoding="utf-8"))
    if lesson.get("status")!="editorial_ready" or lesson.get("date")!=date:
        print("SKIP: no validated editorial for "+date+"; no fake Canva design created")
        return
    output=path.parent / "canva-import.pptx"
    sensory=lesson.get('edition')=='sensory-v2.1'
    reason='missing_original_artwork'
    if sensory and not (path.parent/'artwork.json').exists():
        try:
            prepare_sensory_artwork(lesson,path.parent)
        except VisualProductionError as error:
            reason=str(error)
    try:
        artwork=artwork_files(lesson,path.parent,allow_fixture=os.getenv("HANA_ALLOW_TEST_ARTWORK")=="1")
    except (ValueError,OSError) as error:
        if not sensory:
            raise
        reason='image_validation_failed'
        artwork=None
    if not artwork:
        lesson["visuals"]={**lesson.get("visuals",{}),"artwork_ready":False,"image_count":0,"human_review":"not_started","reason":reason}
        atomic_json(path,lesson)
        if sensory:
            record_visual_stage(path,lesson,'artwork_blocked',reason)
        print("BLOCKED: "+reason+"; copy is retained")
        return
    count=create(lesson,output,artwork)
    check=Presentation(output)
    assert count==len(check.slides)==page_count(lesson)
    assert check.slide_width*5==check.slide_height*4
    atomic_json(path,lesson)
    if sensory:
        record_visual_stage(path,lesson,'visual_human_review_pending')
    print(f"PASS: editable {count}-page Canva PowerPoint source: "+str(output.relative_to(ROOT)))
    print("DRAFT: custom PowerPoint typography is not verified against the native Canva reference")
if __name__=="__main__":
    main()
