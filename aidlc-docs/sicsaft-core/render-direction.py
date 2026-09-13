"""Original canvas direction board, not an application screenshot."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

base = Path(__file__).parent
fonts = Path("C:/Users/jonat/.codex/skills/canvas-design/canvas-fonts")
canvas = Image.new("RGB", (1600, 1100), "#071020")
d = ImageDraw.Draw(canvas)
display = ImageFont.truetype(str(fonts / "BigShoulders-Regular.ttf"), 108)
small = ImageFont.truetype(str(fonts / "ArsenalSC-Regular.ttf"), 22)
ink, dim, blue = "#F3F6FC", "#BAC9E0", "#559BEE"
d.text((88, 64), "SICSAFT     /     ESTUDIO 01", font=small, fill=dim)
d.text((88, 118), "CONTROL SERENO", font=display, fill=ink)
d.line((88, 276, 1512, 276), fill="#283A54", width=1)
# Registration field: held objects, a checked position, and an intentional absence.
for row in range(5):
    for col in range(12):
        x, y = 96 + col * 120, 354 + row * 112
        if (row, col) == (2, 7):
            for dx, dy, sx, sy in [(0,0,1,1),(64,0,-1,1),(0,64,1,-1),(64,64,-1,-1)]:
                d.line((x+dx,y+dy,x+dx+sx*12,y+dy),fill="#D8AC65",width=2)
                d.line((x+dx,y+dy,x+dx,y+dy+sy*12),fill="#D8AC65",width=2)
            continue
        color = blue if col == 4 else "#14263F"
        d.rounded_rectangle((x,y,x+64,y+64),radius=12,fill=color)
        if col == 4:
            d.line((x+20,y+33,x+29,y+42,x+47,y+23),fill=ink,width=3)
        d.text((x,y+74), f"{row+1:02}.{col+1:02}",font=small,fill=dim)
d.line((88, 952, 1512, 952),fill="#283A54",width=1)
d.text((88, 987), "CAPTURA     /     CUSTODIA     /     EVIDENCIA",font=small,fill=dim)
for i, color in enumerate(["#071020","#14263F","#559BEE","#BAC9E0","#F3F6FC"]):
    d.rectangle((1240+i*54,986,1280+i*54,1026), fill=color, outline="#283A54")
canvas.save(base / "control-sereno.png")
