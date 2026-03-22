import zlib, struct

def analyze(path):
    data = open(path,'rb').read()
    pos = 8; chunks = {}
    while pos < len(data):
        l = struct.unpack('>I', data[pos:pos+4])[0]
        ct = data[pos+4:pos+8]
        chunks.setdefault(ct, []).append(data[pos+8:pos+8+l])
        pos += 12 + l
    w, h = struct.unpack('>II', chunks[b'IHDR'][0][:8])
    raw = zlib.decompress(b''.join(chunks[b'IDAT']))
    stride = w * 4 + 1

    def alpha(x, y):
        return raw[y * stride + 1 + x * 4 + 3]

    # Find bounding box
    minx, maxx, miny, maxy = w, 0, h, 0
    for y in range(0, h, 8):
        base = y * stride + 1
        for x in range(0, w, 8):
            if raw[base + x*4 + 3] > 20:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y

    print('%s: %dx%d  content bbox x=[%d-%d] y=[%d-%d]' % (path.split('/')[-1], w, h, minx, maxx, miny, maxy))

    # For fire.png, detect column structure by scanning for gaps in x
    if 'fire' in path:
        # Sample alpha per column band to find frame cols
        for ncols in [1, 2, 4, 5, 6, 8, 10]:
            fw = w // ncols
            counts = []
            for c in range(ncols):
                x0, x1 = c*fw, (c+1)*fw
                cnt = 0
                for y in range(0, h, 4):
                    for x in range(x0, x1, 4):
                        if alpha(x, y) > 20:
                            cnt += 1
                counts.append(cnt)
            nonempty = sum(1 for c in counts if c > 0)
            print('  %d cols: nonempty=%d  counts=%s' % (ncols, nonempty, counts[:10]))

analyze('/Users/mihaciuc/hack-it/Hack-de-pensionare/extension/assets/fire.png')
analyze('/Users/mihaciuc/hack-it/Hack-de-pensionare/extension/assets/lighter.png')
