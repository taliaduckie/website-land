Attempt @ an interactive orrery as a personal site. P basic setup - vanilla JS, single <canvas>. 

Concept

The sun sits @ center w name + about card. Interests/relevant topics are planets. Radius and orbit distance roughly encode emphasis but not super agro about it. Each planet has relevant moons: projects, essays, work etc etc. You can click a planet to zoom into its moons. Click the sun for the about card.

Currently orbiting: pragmatics stuff, AI thoughts, bad food science, photography, writing, violin. May change w time!

Files

index.html    shell: canvas elements, panel markup, font links
styles.css    all visual styling
content.js    all words/numbers. edit this, not orrery.js
orrery.js     engine: orbital math, rendering, hit-testing, interaction

content.js is a plain SITE object, three sections:


sun: label, description, color, size, about-card copy
social: corner link bar (label/href pairs)
planets: array. Each: color, r (size = weight), a (orbit radius), e (eccentricity, 0-~0.2), period (seconds/orbit), rot (orbit tilt, radians). Optional pattern: 'glass'. Optional ring: { inner, outer, tilt, angle, color, alpha }. moons: [{ name, desc, dr, period, e, rot, body, href }]


New planet, retitled moon, new color: all content.js, never orrery.js.

Running locally

bashpython3 -m http.server 8000

Open localhost:8000. file:// mostly works but some browsers block local script loading. Use a server.

how it works!


One requestAnimationFrame loop: update (positions) then render (redraw).
Camera is an eased target. view chases target for zoom on planet click.
Two modes: system (all planets) / planet (one planet's moons). Focusing locks camera to that planet, fades in moons.
Hover freezes orbit (isPlanetPaused / isMoonPaused, checked in update).
Background stars + 25 constellation asterisms computed once (bgCanvas, constItems), not per frame.
drawBody: radial gradient lit from sun's direction, separate darkened terminator gradient on far side, optional seeded drawGlass marbling (seeded so it's stable, not shimmering).
Rings drawn in two passes (drawRingHalf front/back) so the planet occludes the far arc correctly.
Mouse: live hit-test on pointermove. Touch: hold-to-hover (300ms), since touch has no persistent cursor.


The unwired stuff

nothing in render() reads pointer position except setHover/positionTip.


pmx/pmty, par, PX_BG/PX_SUN/etc: declared. Nothing updates them on pointermove or applies them as a layer offset.
#comet/cctx: exist. Nothing pushes into trail or draws it.
constItems: built. No drawConstellations call to render it.


Site runs fine w/o these. They're the parallax/comet-trail/constellation effects from the design pass, just not wired in. Same cause, so: one pointer-state plumbing fix, then three thin draw calls downstream. Keeps tuning (easing constant, trail decay, opacity lerp) isolable even w/ shared wiring.

Fonts and vibes

IM Fell English (headings), Libre Baskerville (body). Both via Google Fonts in index.html. Swap the <link> and CSS font-family together.
