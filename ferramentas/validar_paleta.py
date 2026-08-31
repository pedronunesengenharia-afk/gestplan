#!/usr/bin/env python3
"""
GestPlan · validador de paleta de gráfico.

Os comentários de `src/estilos/graficos.css` sempre falaram deste validador, e
ele nunca existiu como arquivo — a conferência tinha sido feita à mão e o
resultado anotado. Isto o torna repetível: mudou uma cor, roda de novo.

Confere, para cada paleta:

  1. faixa de luminosidade — nenhuma cor perdida no claro nem no escuro;
  2. piso de croma — cor lavada vira cinza no projetor;
  3. separação sob DEUTERANOPIA e PROTANOPIA (8% dos homens);
  4. separação em visão normal;
  5. contraste de cada cor com a superfície do gráfico.

A simulação de daltonismo é a de Viénot, Brettel & Mollon (1999), que é a
usada pelas ferramentas de acessibilidade sérias. ΔE é CIE76 sobre L*a*b* —
mais simples que CIEDE2000 e conservador para o que se quer aqui: se passa em
CIE76 com folga, passa.

Uso:  python ferramentas/validar_paleta.py
"""

import io
import math
import sys

# O console do Windows abre em cp1252 e engasga no "delta". Forcar UTF-8 aqui e
# mais honesto do que trocar o simbolo por "dE" e fingir que nao ha acento.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------- cor ------


def de_hex(h):
    h = h.strip().lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))


def para_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, round(c * 255))):02X}" for c in rgb)


def linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def sgama(c):
    c = max(0.0, min(1.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def para_xyz(rgb):
    r, g, b = (linear(c) for c in rgb)
    return (
        0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
        0.2126729 * r + 0.7151522 * g + 0.0721750 * b,
        0.0193339 * r + 0.1191920 * g + 0.9503041 * b,
    )


BRANCO = (0.95047, 1.0, 1.08883)


def para_lab(rgb):
    x, y, z = para_xyz(rgb)
    def f(t):
        return t ** (1 / 3) if t > 216 / 24389 else (841 / 108) * t + 4 / 29
    fx, fy, fz = f(x / BRANCO[0]), f(y / BRANCO[1]), f(z / BRANCO[2])
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def luminancia(rgb):
    r, g, b = (linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    la, lb = luminancia(a), luminancia(b)
    claro, escuro = max(la, lb), min(la, lb)
    return (claro + 0.05) / (escuro + 0.05)


def croma(rgb):
    _, a, b = para_lab(rgb)
    return math.hypot(a, b)


def delta_e(a, b):
    la = para_lab(a)
    lb = para_lab(b)
    return math.dist(la, lb)


# ------------------------------------------------- daltonismo (Viénot) -----
# RGB linear -> LMS
_RGB_LMS = [
    [17.8824, 43.5161, 4.11935],
    [3.45565, 27.1554, 3.86714],
    [0.0299566, 0.184309, 1.46709],
]
_LMS_RGB = [
    [0.080944, -0.130504, 0.116721],
    [-0.0102485, 0.0540194, -0.113615],
    [-0.000365294, -0.00412163, 0.693513],
]
_SIM = {
    "protan": [[0, 2.02344, -2.52581], [0, 1, 0], [0, 0, 1]],
    "deutan": [[1, 0, 0], [0.494207, 0, 1.24827], [0, 0, 1]],
}


def _mul(m, v):
    return tuple(sum(m[i][j] * v[j] for j in range(3)) for i in range(3))


def simular(rgb, tipo):
    lin = tuple(linear(c) for c in rgb)
    lms = _mul(_RGB_LMS, lin)
    lms2 = _mul(_SIM[tipo], lms)
    lin2 = _mul(_LMS_RGB, lms2)
    return tuple(sgama(c) for c in lin2)


# ------------------------------------------------------------ conferir -----

MIN_DELTA_ADJ = 8.0     # pares vizinhos na ordem fixa: nunca confundíveis
MIN_DELTA_QUALQUER = 5.0  # qualquer par, sob daltonismo
MIN_CROMA = 22.0
MIN_CONTRASTE = 2.6     # cor de dado sobre a superfície do gráfico


def conferir(nome, cores, superficie):
    cores = [de_hex(c) for c in cores]
    sup = de_hex(superficie)
    problemas = []

    ls = [para_lab(c)[0] for c in cores]
    print(f"\n=== {nome} ===")
    print(f"  L*: {min(ls):.0f} a {max(ls):.0f}   (faixa {max(ls)-min(ls):.0f})")

    for i, c in enumerate(cores):
        ch = croma(c)
        ct = contraste(c, sup)
        marca = ""
        if ch < MIN_CROMA:
            problemas.append(f"cor {i+1} {para_hex(c)}: croma {ch:.0f} < {MIN_CROMA}")
            marca += "  <- lavada"
        if ct < MIN_CONTRASTE:
            problemas.append(f"cor {i+1} {para_hex(c)}: contraste {ct:.2f} < {MIN_CONTRASTE}")
            marca += "  <- some no fundo"
        print(f"  {i+1} {para_hex(c)}  croma {ch:5.1f}  contraste {ct:4.2f}{marca}")

    for visao in ("normal", "protan", "deutan"):
        vistas = cores if visao == "normal" else [simular(c, visao) for c in cores]
        pior_adj = min(
            (delta_e(vistas[i], vistas[i + 1]), i) for i in range(len(vistas) - 1)
        )
        pior_qq = min(
            (delta_e(vistas[i], vistas[j]), i, j)
            for i in range(len(vistas))
            for j in range(i + 1, len(vistas))
        )
        print(
            f"  {visao:7} pior vizinho ΔE {pior_adj[0]:5.1f} (cores {pior_adj[1]+1}/{pior_adj[1]+2})"
            f"   pior par ΔE {pior_qq[0]:5.1f} (cores {pior_qq[1]+1}/{pior_qq[2]+1})"
        )
        if pior_adj[0] < MIN_DELTA_ADJ:
            problemas.append(
                f"{visao}: vizinhos {pior_adj[1]+1}/{pior_adj[1]+2} com ΔE {pior_adj[0]:.1f}"
            )
        if visao != "normal" and pior_qq[0] < MIN_DELTA_QUALQUER:
            problemas.append(
                f"{visao}: par {pior_qq[1]+1}/{pior_qq[2]+1} com ΔE {pior_qq[0]:.1f}"
            )
    return problemas


if __name__ == "__main__":
    import re
    import pathlib

    css = pathlib.Path("src/estilos/graficos.css").read_text(encoding="utf-8")

    def ler(prefixo, n, bloco=None):
        alvo = css if bloco is None else css.split(bloco)[1]
        return [
            re.search(rf"--{prefixo}{i}:\s*(#[0-9A-Fa-f]{{6}})", alvo).group(1)
            for i in range(1, n + 1)
        ]

    ruim = []
    ruim += conferir("categórica · tema claro", ler("g", 6), "#FFFFFF")
    ruim += conferir(
        "categórica · tema escuro",
        ler("g", 6, "prefers-color-scheme: dark"),
        "#132C33",
    )

    print()
    if ruim:
        print("REPROVADO:")
        for p in ruim:
            print("  ·", p)
        sys.exit(1)
    print("Paleta aprovada nos cinco checks, nos dois temas.")
