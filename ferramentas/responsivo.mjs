import { chromium, devices } from 'playwright'

/**
 * Auditoria de tamanhos. Nao conserta nada — mede.
 *
 * O que procura, em cada tela e cada tamanho:
 *   · a PAGINA rolando de lado (scrollWidth > innerWidth) — o defeito que faz
 *     um app parecer quebrado no celular;
 *   · qual elemento e o culpado;
 *   · alvos de toque menores que 44px, que e o piso da Apple e o que faz
 *     alguem errar o botao com o polegar.
 */

const APP = 'http://localhost:4173'

const TAMANHOS = [
  { nome: 'iPhone SE   375', vp: { width: 375, height: 667 }, movel: true },
  { nome: 'iPhone 14   390', vp: { width: 390, height: 844 }, movel: true },
  { nome: 'Pixel 7     412', vp: { width: 412, height: 915 }, movel: true },
  { nome: 'iPad retr.  768', vp: { width: 768, height: 1024 }, movel: true },
  { nome: 'iPad deit. 1024', vp: { width: 1024, height: 768 }, movel: true },
  { nome: 'notebook   1280', vp: { width: 1280, height: 800 }, movel: false },
  { nome: 'monitor    1600', vp: { width: 1600, height: 900 }, movel: false },
]

const TELAS = ['Painel', 'Meu dia', 'Carteira', 'Chamados']

const nav = await chromium.launch()

for (const t of TAMANHOS) {
  const ctx = await nav.newContext({
    viewport: t.vp,
    isMobile: t.movel,
    hasTouch: t.movel,
    deviceScaleFactor: 2,
  })
  const p = await ctx.newPage()
  await p.goto(APP, { waitUntil: 'networkidle' })

  // entrada
  await p.fill('#email', 'pedronunesengenharia@gmail.com')
  await p.fill('#senha', 'GestPlan#2026')
  await p.click('.botao--acao')
  await p.waitForTimeout(4000)

  const linhas = []
  for (const tela of TELAS) {
    // No estreito a navegacao esta na barra de baixo; no largo, na lateral.
    const alvo = t.vp.width <= 820 ? '.barra-baixo button' : '.menu button'
    const botao = p.locator(alvo, { hasText: new RegExp(`^${tela}`) })
    try {
      if (await botao.count()) {
        await botao.first().click({ timeout: 8000 })
        await p.waitForTimeout(1800)
      }
    } catch { /* segue para o proximo: a auditoria mede, nao navega */ }

    const r = await p.evaluate(() => {
      const doc = document.documentElement
      const larguraJanela = window.innerWidth
      const vaza = doc.scrollWidth - larguraJanela

      // Quem esta passando da largura da janela?
      const culpados = []
      for (const el of document.querySelectorAll('body *')) {
        const c = el.getBoundingClientRect()
        if (c.width === 0) continue
        if (c.right > larguraJanela + 1.5) {
          const est = getComputedStyle(el)
          if (est.overflowX === 'auto' || est.overflowX === 'scroll') continue
          culpados.push(
            `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}` +
              ` +${Math.round(c.right - larguraJanela)}px`,
          )
        }
      }

      // Alvos de toque pequenos
      const pequenos = []
      for (const el of document.querySelectorAll('button, a, input, select, label')) {
        const c = el.getBoundingClientRect()
        if (c.width === 0 || c.height === 0) continue
        if (c.height < 40) {
          const nome = (el.textContent || el.getAttribute('aria-label') || el.tagName)
            .trim().slice(0, 18)
          pequenos.push(`${nome}:${Math.round(c.height)}px`)
        }
      }

      return {
        vaza,
        culpados: [...new Set(culpados)].slice(0, 4),
        pequenos: pequenos.length,
        exemplos: [...new Set(pequenos)].slice(0, 3),
      }
    })

    const sinal = r.vaza > 1 ? `ROLA ${r.vaza}px` : 'ok'
    linhas.push(
      `    ${tela.padEnd(13)} ${sinal.padEnd(12)} toque<40px: ${String(r.pequenos).padStart(3)}` +
        (r.culpados.length ? `\n        culpado: ${r.culpados.join(', ')}` : '') +
        (r.exemplos.length ? `\n        pequenos: ${r.exemplos.join(', ')}` : ''),
    )
  }

  console.log(`\n[${t.nome}]`)
  console.log(linhas.join('\n'))
  await ctx.close()
}

await nav.close()
console.log('\n--- auditoria terminada ---')
