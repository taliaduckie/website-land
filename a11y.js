/* Single source for the hidden search/screen-reader outline.
   Pure: takes the SITE object, returns an HTML string (no DOM).
   Used by orrery.js (runtime) and prerender.js (build) so they never drift. */
(function (root) {
  function esc(t){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function clean(t){ return esc(String(t || '').replace(/\*/g, '').replace(/\n/g, ' ')); }  // strip italic markers / line breaks

  function a11yOutline(SITE){
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
    return h;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = a11yOutline;
  else root.a11yOutline = a11yOutline;
})(typeof globalThis !== 'undefined' ? globalThis : this);
