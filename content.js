/* ============================================================
   content.js — EDIT ME
   All the words, colors, and numbers live here. The engine
   (orrery.js) reads this object and never needs to be touched.

   color   : hex string, e.g. '#9b3d34'
   r       : body size in world units (relative emphasis; bigger = more weight)
   a       : orbit radius (distance from the sun)
   e       : eccentricity 0..~0.2 (how elliptical / non-mechanical the orbit is)
   period  : seconds for one full orbit (bigger = slower)
   rot     : orientation of the orbit ellipse, in radians (just vary it per body)

   moons   : dr = orbit radius around the planet, the rest as above.
             body = the card text. href = link the "open →" goes to.
   ============================================================ */

const SITE = {
  sun: {
    label: 'Your Name',   // <- shown under the sun. Put your name here.
    desc:  'click to read more.',
    color: '#c47a2f',
    r: 46,
    about: {
      kicker: '',          // optional small line above the name; leave '' to hide
      name: 'Your Name',
      paragraphs: [
        'A placeholder summary of me — the one paragraph that explains why these particular planets orbit the same sun. What is the through-line? The instinct, question, or habit of mind that shows up whether you are reading about implicature, training a model, or pulling a roll of film.',
        'A second placeholder line for the practical version: who you are, what you do, and where someone should start. Replace all of this later.'
      ],
      links: [
        { label: 'email',     href: '#' },
        { label: 'cv',        href: '#' },
        { label: 'elsewhere', href: '#' }
      ]
    }
  },

  // varied sizes (emphasis), orbits, eccentricities, periods (slow, all different)
  planets: [
    {
      name: 'formal pragmatics',
      desc: 'how meaning outruns what is literally said.',
      color: '#9b3d34', r: 27, a: 175, e: 0.09, period: 74, rot: 0.35,
      moons: [
        { name: 'implicature & inference',        dr: 50, period: 17, e: 0.06, rot: 0.4, href: '#', body: 'A placeholder note on how listeners reconstruct intended meaning from sparse signals.' },
        { name: 'speech acts',                    dr: 74, period: 25, e: 0.12, rot: 2.1, href: '#', body: 'Placeholder: doing things with words — promises, requests, the force behind a sentence.' },
        { name: 'the semantics–pragmatics line',  dr: 96, period: 34, e: 0.08, rot: 4.0, href: '#', body: 'Placeholder essay on where encoded meaning ends and context takes over.' }
      ]
    },
    {
      name: 'AI safety',
      desc: 'keeping capable systems pointed the right way.',
      color: '#5d7a44', r: 31, a: 262, e: 0.13, period: 108, rot: 1.15, // largest — strong emphasis
      moons: [
        { name: 'interpretability notes',  dr: 52,  period: 19, e: 0.05, rot: 1.0, href: '#', body: 'Placeholder: reading the internals of a model and trying to say what it is doing.' },
        { name: 'incentives & alignment',  dr: 78,  period: 28, e: 0.14, rot: 3.0, href: '#', body: 'Placeholder on objectives, proxies, and the gap between them.' },
        { name: 'evaluation design',       dr: 100, period: 37, e: 0.09, rot: 5.1, href: '#', body: 'Placeholder: how to measure what we actually care about.' }
      ]
    },
    {
      name: 'food science',
      desc: 'the chemistry and craft of what we eat.',
      color: '#b06a2c', r: 21, a: 348, e: 0.06, period: 152, rot: 2.05,
      moons: [
        { name: 'fermentation log', dr: 48, period: 16, e: 0.07, rot: 0.7, href: '#', body: 'Placeholder: notes from jars on the counter — time, salt, and microbes.' },
        { name: 'maillard & heat',  dr: 72, period: 26, e: 0.10, rot: 2.6, href: '#', body: 'Placeholder on browning, flavor, and the geometry of a good sear.' }
      ]
    },
    {
      name: 'film photography',
      desc: 'light, grain, and the patience of analog.',
      color: '#356b6b', r: 18, a: 432, e: 0.16, period: 188, rot: 2.75,
      moons: [
        { name: 'velvia diaries',   dr: 50, period: 18, e: 0.08, rot: 1.4, href: '#', body: 'Placeholder: saturated transparencies and the color of late afternoon.' },
        { name: 'portra vs. ektar', dr: 74, period: 27, e: 0.13, rot: 3.5, href: '#', body: 'Placeholder comparison of two stocks and the moods they carry.' },
        { name: 'darkroom notes',   dr: 96, period: 35, e: 0.06, rot: 5.6, href: '#', body: 'Placeholder: timing, temperature, and the smell of fixer.' }
      ]
    },
    {
      name: 'writing',
      desc: 'essays that tie the other threads together.',
      color: '#7a3f57', r: 24, a: 520, e: 0.10, period: 232, rot: 3.45,
      moons: [
        { name: 'essays',       dr: 50, period: 17, e: 0.07, rot: 0.9, href: '#', body: 'Placeholder for longer pieces — the connective tissue made explicit.' },
        { name: 'fragments',    dr: 76, period: 27, e: 0.11, rot: 3.2, href: '#', body: 'Placeholder: half-thoughts kept until they find their planet.' },
        { name: 'reading list', dr: 98, period: 36, e: 0.05, rot: 5.4, href: '#', body: 'Placeholder: what is on the desk right now.' }
      ]
    }
  ]
};
