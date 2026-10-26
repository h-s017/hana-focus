#!/usr/bin/env python3
"""Create an editable PowerPoint source for Canva's officially supported REST import.
All visible text remains real PPTX text boxes. No credentials or customer records.
"""
import json
import os
import re
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

ROOT=Path(__file__).resolve().parents[1]
COLORS=("#252c2c","#303335","#343733","#292e33","#36332f","#27322f")
KEYWORDS=("OBSERVATION","LAYERING","FOREGROUND","BACKGROUND","BALANCE","EXERCISE")
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
def box(slide,x,y,w,h,color,transparency=0,rotation=None,outline=False):
    if outline:
        shape=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h))
        shape.fill.background()
        shape.line.color.rgb=rgb(color)
    else:
        shape=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,Inches(x),Inches(y),Inches(w),Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb=rgb(color)
        shape.line.fill.background()
    if rotation is not None:
        shape.rotation=rotation
    return shape

def create(lesson,output):
    slides=lesson.get("pages") or []
    if len(slides)!=6 or not all(isinstance(x.get("title"),str) and isinstance(x.get("body"),str) for x in slides):
        raise ValueError("Expected exactly six real text pages")
    deck=Presentation()
    deck.slide_width=Inches(8)
    deck.slide_height=Inches(10)
    for i,part in enumerate(slides):
        slide=deck.slides.add_slide(deck.slide_layouts[6])
        # Matte charcoal backgrounds and restrained geometric shapes, not flat raster screenshots.
        back=slide.background.fill
        back.solid()
        back.fore_color.rgb=rgb(COLORS[i])
        box(slide,.66,1.35,6.62,6.42,"#788079",outline=True,rotation=-3 if i%2 else 2)
        circle=slide.shapes.add_shape(MSO_SHAPE.OVAL,Inches(2.1),Inches(2.65),Inches(3.7),Inches(3.7))
        circle.fill.background()
        circle.line.color.rgb=rgb("#858d84")
        # Quiet background motif, no people/citrus or embedded typography.
        box(slide,4.5,1.85,2.0,5.0,"#565d58",rotation=13+i*3)
        box(slide,.7,.8,6.65,.015,"#8b918a")
        label(slide,"HANA SCENT ARTIST",.74,.35,6.5,.33,12,"#d3cdc2",font="Arial")
        label(slide,KEYWORDS[i],.75,1.43,6.5,.31,12,"#c9c4b6",font="Arial")
        label(slide,part["title"],.74,2.13,6.7,2.2,39,"#f1efe6",font="Noto Serif CJK TC")
        box(slide,.74,4.47,.9,.025,"#b6a98f")
        label(slide,part["body"],.74,4.92,6.4,2.6,23,"#e0dfd8",font="Noto Serif CJK TC")
        box(slide,.74,9.1,6.52,.014,"#8b918a")
        label(slide,"OLFACTORY ART  ·  "+str(lesson["date"])[:4],.74,9.36,4.8,.33,11,"#c2bcb0",font="Arial")
        label(slide,f"{i+1:02d} / 06",6.04,9.31,1.4,.43,18,"#e5e2d5",font="Georgia")
    output.parent.mkdir(parents=True,exist_ok=True)
    deck.save(output)
    return len(deck.slides)

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
    count=create(lesson,output)
    check=Presentation(output)
    assert count==len(check.slides)==6
    assert check.slide_width*5==check.slide_height*4
    print("PASS: editable 6-page Canva PowerPoint source: "+str(output.relative_to(ROOT)))
if __name__=="__main__":
    main()
