/* Build step (run by the deploy Action, not needed locally): reads the SITE
   object from content.js and bakes the accessibility/SEO outline into index.html's
   #a11y element, so search engines & non-JS crawlers get it without running JS.
   Mirrors buildA11y() in orrery.js — keep the two in sync. */
const fs = require('fs');

let src = fs.readFileSync('content.js', 'utf8').replace('const SITE', 'globalThis.SITE');
eval(src);

const esc = t => String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clean = t => esc(String(t || '').replace(/\*/g, '').replace(/\n/g, ' '));

const a = SITE.sun.about || {};
let h = '<h1>' + esc(a.name || SITE.sun.label) + '</h1>';
(a.paragraphs || []).forEach(p => h += '<p>' + clean(p) + '</p>');
h += '<ul>';
(a.links || []).concat(SITE.social || []).forEach(l => { if (l && l.href) h += '<li><a href="' + esc(l.href) + '">' + esc(l.label) + '</a></li>'; });
h += '</ul>';
(SITE.planets || []).forEach(p => {
  h += '<section><h2>' + esc(p.name) + '</h2><p>' + clean(p.desc) + '</p><ul>';
  (p.moons || []).forEach(m => {
    h += '<li><h3>' + esc(m.name) + '</h3>';
    if (m.body) h += '<p>' + clean(m.body) + '</p>';
    const links = Array.isArray(m.links) ? m.links : (m.href && m.href !== '#' ? [{ label: 'link', href: m.href }] : []);
    links.forEach(l => { if (l && l.href) h += ' <a href="' + esc(l.href) + '">' + esc(l.label || 'link') + '</a>'; });
    h += '</li>';
  });
  h += '</ul></section>';
});

let html = fs.readFileSync('index.html', 'utf8');
const marker = /<main id="a11y" class="sr-only">[\s\S]*?<\/main>/;
if (!marker.test(html)) { console.error('prerender: #a11y marker not found in index.html'); process.exit(1); }
html = html.replace(marker, '<main id="a11y" class="sr-only">' + h + '</main>');
fs.writeFileSync('index.html', html);
console.log('prerendered a11y outline into index.html (' + h.length + ' chars)');
