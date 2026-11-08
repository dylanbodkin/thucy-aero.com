import math, sys
# Geometry pulled from Grasshopper_prototype.vsp3 (meters). x = aft, y = right.
COL, ROW = 0.0215, 0.043            # meters per char (chars are ~2:1 tall)
YMAX, XMIN, XMAX = 1.17, -0.13, 1.27
HALF = int(YMAX/COL); W = 2*HALF+1; H = int((XMAX-XMIN)/ROW)+1
grid = [[' ']*W for _ in range(H)]
def cell(x, y): return int(round((x-XMIN)/ROW)), HALF + int(math.copysign(math.floor(abs(y)/COL+0.5), y))
def put(x, y, ch):
    r, c = cell(x, y)
    if 0 <= r < H and 0 <= c < W: grid[r][c] = ch
def fill(inside, ch, edge=None):
    for r in range(H):
        for c in range(W):
            x, y = XMIN + r*ROW, (c-HALF)*COL
            if inside(x, y):
                if edge and not all(inside(x+dx*ROW, y+dy*COL) for dx, dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    grid[r][c] = edge(x, y, inside)
                else:
                    grid[r][c] = ch

# main wing: LE x=0.25; inboard rect chord .28 to |y|=.35; outboard taper .28->.20, LE sweep -0.865 deg
def wing(x, y):
    a = abs(y)
    if a <= 0.35: le, ch = 0.25, 0.28
    elif a <= 1.145:
        t = (a-0.35)/0.795; le = 0.25 + (a-0.35)*math.tan(math.radians(-0.865)); ch = 0.28 - 0.08*t
    else: return False
    return le <= x <= le+ch
def wing_edge(x, y, f):
    if not f(x-ROW, y): return '_' if f(x, y) and grid_row_top(x) else '='
    if not f(x+ROW, y): return '='
    return '|'
grid_row_top = lambda x: False
fill(wing, ':', wing_edge)

# inverted-V tail: x 1.0..1.151, spans to the boom ends
for i in range(0, 200):
    y = -0.35 + 0.7*i/199
    for x in (1.0, 1.151): put(x, y, '=')
fill(lambda x, y: 1.0 < x < 1.151 and abs(y) < 0.35, ':')

# booms (dia 16 mm) x .0416..1.2416 at y=+-.35
for s in (-1, 1):
    x = 0.0416
    while x <= 1.2416: put(x, s*0.35, 'H'); x += ROW/2

# fuselage, ellipse sections
fsec = [(0,0),(0.0333,0.0267),(0.1,0.04),(0.3,0.04),(0.48,0.04),(0.6,0.0267)]
def frad(x):
    for (x0,r0),(x1,r1) in zip(fsec, fsec[1:]):
        if x0 <= x <= x1: return r0 + (r1-r0)*(x-x0)/(x1-x0)
    return -1
fill(lambda x, y: abs(y) <= max(frad(x), COL*0.6) and 0 <= x <= 0.6, '#')
put(0.0, 0, 'A')
# pusher motor + 3-blade prop (disc seen edge-on, dia .279)
fill(lambda x, y: 0.5735 <= x <= 0.6275 and abs(y) <= 0.0176+COL*0.4, '@')
for i in range(60):
    put(0.628+ROW*0.6, -0.1395 + 0.279*i/59, '~')

# lift rotors: 2-blade, dia .305, at fwd/aft of each boom
for rx in (0.0416, 0.6824):
    for ry in (-0.35, 0.35):
        R = 0.1525
        for k in range(360):
            a = math.radians(k); put(rx + R*math.cos(a), ry + R*math.sin(a), '.')
        for k in range(-40, 41):
            put(rx, ry + R*0.95*k/40, '-')
        put(rx, ry, 'O')

out = '\n'.join(''.join(r).rstrip() for r in grid)
TOP = out

# ---------- front view (looking aft): y across, z up ----------
ZMIN, ZMAX, ZR = -0.16, 0.34, 0.043
FH = int(round((ZMAX-ZMIN)/ZR))+1
fg = [[' ']*W for _ in range(FH)]
def fput(y, z, ch, over=True):
    r = int(round((ZMAX-z)/ZR)); c = HALF + int(math.copysign(math.floor(abs(y)/COL+0.5), y))
    if 0 <= r < FH and 0 <= c < W and (over or fg[r][c] == ' '): fg[r][c] = ch
# pusher prop disc, seen face-on behind the fuselage (dia .279)
for k in range(360):
    a = math.radians(k); fput(0.1395*math.cos(a), 0.1395*math.sin(a), '.')
# inverted-V tail from (0, .298) down to boom ends
for i in range(200):
    t = i/199
    for s in (-1, 1): fput(s*0.35*t, 0.298*(1-t), '/' if s < 0 else '\\')
# wing at z=.03 (thin slab), spanning +-1.145
for i in range(-int(1.145/COL), int(1.145/COL)+1): fput(i*COL, 0.03, '=')
for s in (-1, 1): fput(s*1.145, 0.03, '|')
# fuselage section (dia .08)
for z in (-0.04, 0.0, 0.04):
    for y in (-COL, 0, COL): fput(y, z, '#')
fput(0, 0.0, '@')
# booms, motors, lift rotors (dia .305 at z=.0475+)
for s in (-1, 1):
    fput(s*0.35, 0.0, 'O')
    fput(s*0.35, 0.03, 'H')
    for i in range(-int(0.1525/COL), int(0.1525/COL)+1): fput(s*0.35 + i*COL, 0.0475+0.043, '-')
    fput(s*0.35, 0.0475+0.043, '+')
FRONT = '\n'.join(''.join(r).rstrip() for r in fg)

title = "G R A S S H O P P E R   //   quadplane VTOL prototype"
spec = ("span 2.29 m  |  4 x 12in 2-blade lift rotors  |  11in 3-blade pusher  |  "
        "inverted-V tail on twin booms")
def center(t): return t.center(W).rstrip()
print(center(title)); print(center('-'*len(title))); print()
print(center('TOP VIEW  (nose up)')); print(); print(TOP); print(); print()
print(center('FRONT VIEW')); print(); print(FRONT); print()
print(center(spec))
