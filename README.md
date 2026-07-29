Interactive orrery as a personal site. vanilla JS, single `<canvas>`, no framework, no build step.

live @ https://taliaduckie.github.io/website-land/

Concept

The sun sits @ center w name + about card. Interests/relevant topics are planets. Radius and orbit distance roughly encode emphasis but not super agro about it. Each planet has relevant moons: projects, essays, work etc etc. Click a planet to zoom into its moons, click a moon for its card, click the sun for the about card. esc / pull-back button to zoom out.

Currently orbiting: pragmatics stuff, AI thoughts, bad food science, photography, writing, violin. May change w time!

Files

index.html    shell: canvas elements, panel markup, meta/og tags, font links
styles.css    all visual styling
content.js    all words/numbers. edit this, not orrery.js
orrery.js     engine: orbital math, rendering, hit-testing, interaction
favicon.svg   lil ringed planet
preview.png   social share image
photos/       hover-peek + portrait images

content.js is a plain SITE object, three sections:

sun: label, description, color, size, about-card copy (name, paragraphs, links)
social: corner link bar (label/href pairs)
planets: array. Each: name, desc, color, r (size = weight), a (orbit radius), e (eccentricity 0-~0.2), period (secs/orbit), rot (orbit tilt, radians). Optional pattern: 'glass'. Optional ring: { inner, outer, tilt, angle, color, alpha }.

  moons: [{ name, body, ... }]. a moon can also carry:
    href: '...'                              single "open →" link, OR
    links: [{ label, href }, ...]            several labeled links
    photos: { 'phrase in body': 'photos/x.jpg' }   that phrase becomes a hover-to-peek image
  body supports *italics* and \n line breaks. leave href '#' (or drop links) for a text-only node.

New planet, retitled moon, new color: all content.js, never orrery.js.

Running locally

python3 -m http.server 8000, open localhost:8000. file:// mostly works but some browsers block local script loading, so a server is safer. deploys straight to GitHub Pages from main, no build step.

how it works!

One requestAnimationFrame loop: update (positions) then render (redraw).
Camera is an eased target; view chases target for zoom on planet click. Two modes: system (all planets) / planet (one planet's moons). Focusing locks camera to that planet, fades in moons.
Hover freezes that orbit (isPlanetPaused / isMoonPaused, checked in update). labels only show on hover/focus; everything else lives in the tooltip.
Background: dark-blue sky, ~320 baked stars + 25 real constellation asterisms placed once (random, non-overlapping, ringed *around* the orrery so they never sit under a planet). dwell on a constellation to reveal its star names.
drawBody: radial gradient lit from the sun's direction + a darkened terminator on the far side + soft bloom + optional seeded drawGlass marbling (seeded so it's stable, not shimmering). rings in two passes (drawRingHalf front/back) so the planet occludes the far arc.
depth: mouse parallax shifts bg/sun/rings/planets by different amounts (par + PX_* constants, eased so it lags). a comet trail evaporates behind the cursor (#comet overlay). the odd shooting star drifts through.
mouse: live hit-test on pointermove. touch: hold-to-hover (300ms), tap = click.
deep links: the URL hash mirrors state (#ai-thoughts, #ai-thoughts/sycophancy-mapping, #about) so back/forward + sharing a specific thing work.
respects prefers-reduced-motion: freezes orbits, kills parallax/comet/shooting-stars, snaps the camera instead of easing.
hidden #a11y text layer (built from SITE) + og/meta tags so search engines & screen readers get the content the canvas otherwise hides.

secret: konami code (↑ ↑ ↓ ↓ ← → ← → b a) or just type "comet" → a little gravity sandbox. pull back & release to fling a comet that orbits the sun and slingshots the planets. esc to leave.

Fonts and vibes

IM Fell English (headings), Libre Baskerville (body). Both via Google Fonts in index.html. Swap the <link> and CSS font-family together.
