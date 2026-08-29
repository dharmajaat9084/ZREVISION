"""Generate a small test PDF and PNG for E2E verification."""
import struct, zlib

# ── PNG: a simple 400x300 image with colored quadrants ──
W, H = 400, 300
rows = []
for y in range(H):
    row = bytearray([0])  # filter type 0
    for x in range(W):
        if x < W // 2 and y < H // 2:
            row += bytes((198, 89, 83))   # red quadrant
        elif x >= W // 2 and y < H // 2:
            row += bytes((217, 142, 50))  # amber
        elif x < W // 2:
            row += bytes((125, 154, 74))  # moss
        else:
            row += bytes((79, 143, 123))  # teal
    rows.append(bytes(row))
raw = b"".join(rows)

def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(raw, 9))
png += chunk(b"IEND", b"")
with open("/home/z/my-project/scripts/verify/test-image.png", "wb") as f:
    f.write(png)

# ── minimal PDF with two pages of text ──
def pdf_line(stream, x, y, size, text, font="F1"):
    return f"BT /{font} {size} Tf {x} {y} Td ({text}) Tj ET\n".encode()

content1 = b"1 0 0 1 0 0 cm\n" + pdf_line(None, 60, 700, 28, "Physics Notes - Chapter 1") + pdf_line(None, 60, 650, 18, "Kinematics: the study of motion.") + pdf_line(None, 60, 620, 18, "v = u + at") + pdf_line(None, 60, 590, 18, "s = ut + (1/2)at^2") + pdf_line(None, 60, 560, 18, "v^2 = u^2 + 2as")
content2 = b"1 0 0 1 0 0 cm\n" + pdf_line(None, 60, 700, 28, "Page 2: Newton's Laws") + pdf_line(None, 60, 650, 18, "First law: inertia.") + pdf_line(None, 60, 620, 18, "Second law: F = ma") + pdf_line(None, 60, 590, 18, "Third law: action-reaction.")

objs = []
objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
objs.append(b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>")
objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 7 0 R /Resources << /Font << /F1 6 0 R >> >> >>")
objs.append(b"<< /Length " + str(len(content1)).encode() + b" >>\nstream\n" + content1 + b"endstream")
objs.append(b"<< /Length " + str(len(content2)).encode() + b" >>\nstream\n" + content2 + b"endstream")
objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

out = b"%PDF-1.4\n"
offsets = []
for i, o in enumerate(objs):
    offsets.append(len(out))
    out += f"{i+1} 0 obj\n".encode() + o + b"\nendobj\n"
xref_pos = len(out)
out += b"xref\n0 " + str(len(objs) + 1).encode() + b"\n"
out += b"0000000000 65535 f \n"
for off in offsets:
    out += f"{off:010d} 00000 n \n".encode()
out += b"trailer\n<< /Size " + str(len(objs) + 1).encode() + b" /Root 1 0 R >>\nstartxref\n" + str(xref_pos).encode() + b"\n%%EOF\n"

with open("/home/z/my-project/scripts/verify/test-notes.pdf", "wb") as f:
    f.write(out)

print("created test-image.png and test-notes.pdf")
