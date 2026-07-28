/* @ds-bundle: {"format":4,"namespace":"SHFFDesignSystem_97e1cc","components":[{"name":"Callout","sourcePath":"components/content/Callout.jsx"},{"name":"CodeBlock","sourcePath":"components/content/CodeBlock.jsx"},{"name":"CtaStrip","sourcePath":"components/content/CtaStrip.jsx"},{"name":"FeedItem","sourcePath":"components/content/FeedItem.jsx"},{"name":"GuideRow","sourcePath":"components/content/GuideRow.jsx"},{"name":"MapCard","sourcePath":"components/content/MapCard.jsx"},{"name":"PageHead","sourcePath":"components/content/PageHead.jsx"},{"name":"SectionHead","sourcePath":"components/content/SectionHead.jsx"},{"name":"SpecCard","sourcePath":"components/content/SpecCard.jsx"},{"name":"WhyCard","sourcePath":"components/content/WhyCard.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Kbd","sourcePath":"components/core/Kbd.jsx"},{"name":"Panel","sourcePath":"components/core/Panel.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"ProgressBar","sourcePath":"components/feedback/ProgressBar.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"ToastStack","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Breadcrumbs","sourcePath":"components/navigation/Breadcrumbs.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"MobileMenu","sourcePath":"components/navigation/MobileMenu.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"Topbar","sourcePath":"components/navigation/Topbar.jsx"},{"name":"Caret","sourcePath":"components/terminal/Caret.jsx"},{"name":"PtyConsole","sourcePath":"components/terminal/PtyConsole.jsx"},{"name":"TerminalWindow","sourcePath":"components/terminal/TerminalWindow.jsx"}],"sourceHashes":{"article.js":"9c1bac3cbc4c","components/content/Callout.jsx":"b9f0a9ab15e4","components/content/CodeBlock.jsx":"b529a7a285cf","components/content/CtaStrip.jsx":"a0c34a9007eb","components/content/FeedItem.jsx":"0278da02ef8c","components/content/GuideRow.jsx":"b5f2cfd38d3e","components/content/MapCard.jsx":"5e56999f3d84","components/content/PageHead.jsx":"26dc440ea0d1","components/content/SectionHead.jsx":"3061ef06c6d9","components/content/SpecCard.jsx":"f0e14ee5cff4","components/content/WhyCard.jsx":"f38272dbe9d9","components/core/Badge.jsx":"3523e641988b","components/core/Button.jsx":"b3da9c49c26e","components/core/Chip.jsx":"dbe00b0e96dd","components/core/Kbd.jsx":"975cd3269806","components/core/Panel.jsx":"0f4b64182961","components/feedback/Dialog.jsx":"77e0e8c5bdf5","components/feedback/ProgressBar.jsx":"074cae11c646","components/feedback/Toast.jsx":"3304ad99393a","components/feedback/Tooltip.jsx":"e1bacaa38248","components/forms/Checkbox.jsx":"b73973518a37","components/forms/Field.jsx":"ed6d430751da","components/forms/Input.jsx":"79052da876af","components/forms/Select.jsx":"cec657388668","components/forms/Switch.jsx":"5b19209ce686","components/navigation/Breadcrumbs.jsx":"a0c7fca1d978","components/navigation/Footer.jsx":"6a1c05af7d60","components/navigation/MobileMenu.jsx":"821024ce0fa0","components/navigation/Tabs.jsx":"ff972d421111","components/navigation/Topbar.jsx":"cfab4a22aacd","components/terminal/Caret.jsx":"753f3a418fdf","components/terminal/PtyConsole.jsx":"e1dc493a3f5c","components/terminal/TerminalWindow.jsx":"f34299dd7c9c","globe.js":"35324ccc47f3","site.js":"b74260af1d67","ui_kits/dock/DockApp.jsx":"9e28c854f63d","ui_kits/site/SiteApp.jsx":"e01637bd08f8"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SHFFDesignSystem_97e1cc = window.SHFFDesignSystem_97e1cc || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// article.js
try { (() => {
/* ============================================================
   Article behaviour: reading progress, copy buttons, TOC spy
   ============================================================ */
(function () {
  const bar = document.getElementById('progress');
  const article = document.querySelector('.article-main');
  function onScroll() {
    if (!bar || !article) return;
    const rect = article.getBoundingClientRect();
    const total = article.offsetHeight - window.innerHeight;
    const passed = -rect.top;
    const pct = Math.max(0, Math.min(1, passed / Math.max(total, 1)));
    bar.style.width = pct * 100 + '%';
  }
  window.addEventListener('scroll', onScroll, {
    passive: true
  });
  onScroll();

  /* copy buttons */
  document.querySelectorAll('.codeblock').forEach(cb => {
    const btn = cb.querySelector('.copy');
    const pre = cb.querySelector('pre');
    if (!btn || !pre) return;
    btn.addEventListener('click', () => {
      const text = pre.innerText;
      const done = () => {
        const old = btn.textContent;
        btn.textContent = 'copied ✓';
        btn.classList.add('ok');
        setTimeout(() => {
          btn.textContent = old;
          btn.classList.remove('ok');
        }, 1300);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);else done();
    });
  });

  /* TOC scrollspy */
  const links = [...document.querySelectorAll('.toc a')];
  const targets = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  function spy() {
    let idx = 0;
    targets.forEach((t, i) => {
      if (t.getBoundingClientRect().top < 120) idx = i;
    });
    links.forEach((l, i) => l.classList.toggle('active', i === idx));
  }
  window.addEventListener('scroll', spy, {
    passive: true
  });
  spy();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "article.js", error: String((e && e.message) || e) }); }

// components/content/Callout.jsx
try { (() => {
function Callout({
  tone = 'note',
  label,
  children
}) {
  const fallback = {
    warn: 'ВНИМАНИЕ',
    tip: 'СОВЕТ',
    note: 'ЗАМЕТКА'
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    className: 'callout ' + tone
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct"
  }, label || fallback), /*#__PURE__*/React.createElement("p", null, children));
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/Callout.jsx", error: String((e && e.message) || e) }); }

// components/content/CodeBlock.jsx
try { (() => {
function CodeBlock({
  lang = 'bash',
  code,
  children
}) {
  const [ok, setOk] = React.useState(false);
  const copy = () => {
    const text = code || (typeof children === 'string' ? children : '');
    navigator.clipboard && navigator.clipboard.writeText(text);
    setOk(true);
    setTimeout(() => setOk(false), 1400);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "codeblock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lang"
  }, lang), /*#__PURE__*/React.createElement("button", {
    className: 'copy' + (ok ? ' ok' : ''),
    onClick: copy
  }, ok ? 'copied' : 'copy')), /*#__PURE__*/React.createElement("pre", null, children || code));
}
Object.assign(__ds_scope, { CodeBlock });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/CodeBlock.jsx", error: String((e && e.message) || e) }); }

// components/content/CtaStrip.jsx
try { (() => {
function CtaStrip({
  title,
  description,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cta-strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-txt"
  }, /*#__PURE__*/React.createElement("strong", null, title), /*#__PURE__*/React.createElement("span", null, description)), action);
}
Object.assign(__ds_scope, { CtaStrip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/CtaStrip.jsx", error: String((e && e.message) || e) }); }

// components/content/FeedItem.jsx
try { (() => {
function FeedItem({
  date,
  title,
  excerpt,
  tag,
  href,
  hidden
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: 'feed-item' + (hidden ? ' hidden' : ''),
    href: href,
    "data-tag": tag
  }, /*#__PURE__*/React.createElement("span", {
    className: "feed-date"
  }, date), /*#__PURE__*/React.createElement("div", {
    className: "feed-main"
  }, /*#__PURE__*/React.createElement("h3", null, title), excerpt && /*#__PURE__*/React.createElement("p", null, excerpt)), tag && /*#__PURE__*/React.createElement("span", {
    className: "feed-tag"
  }, tag));
}
Object.assign(__ds_scope, { FeedItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/FeedItem.jsx", error: String((e && e.message) || e) }); }

// components/content/GuideRow.jsx
try { (() => {
function GuideRow({
  index,
  title,
  description,
  href
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "guide-row",
    href: href
  }, index && /*#__PURE__*/React.createElement("span", {
    className: "gnum"
  }, index), /*#__PURE__*/React.createElement("div", {
    className: "gmain"
  }, /*#__PURE__*/React.createElement("h3", null, title), description && /*#__PURE__*/React.createElement("p", null, description)), /*#__PURE__*/React.createElement("span", {
    className: "garr"
  }, "\u2192"));
}
Object.assign(__ds_scope, { GuideRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/GuideRow.jsx", error: String((e && e.message) || e) }); }

// components/content/MapCard.jsx
try { (() => {
function MapCard({
  emoji,
  title,
  description,
  count,
  href
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "map-card",
    href: href
  }, emoji && /*#__PURE__*/React.createElement("span", {
    className: "emoji"
  }, emoji), /*#__PURE__*/React.createElement("h3", null, title), description && /*#__PURE__*/React.createElement("p", null, description), count && /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, count, /*#__PURE__*/React.createElement("span", {
    className: "arr"
  }, "\u2192")));
}
Object.assign(__ds_scope, { MapCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/MapCard.jsx", error: String((e && e.message) || e) }); }

// components/content/PageHead.jsx
try { (() => {
function PageHead({
  kicker,
  title,
  lede,
  crumbs,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, crumbs, kicker && /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, kicker), /*#__PURE__*/React.createElement("h1", null, title), lede && /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, lede), children);
}
Object.assign(__ds_scope, { PageHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/PageHead.jsx", error: String((e && e.message) || e) }); }

// components/content/SectionHead.jsx
try { (() => {
function SectionHead({
  kicker,
  title,
  note
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, kicker && /*#__PURE__*/React.createElement("span", {
    className: "sec-kicker"
  }, kicker), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, title), note && /*#__PURE__*/React.createElement("span", {
    className: "sec-note"
  }, note));
}
Object.assign(__ds_scope, { SectionHead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/SectionHead.jsx", error: String((e && e.message) || e) }); }

// components/content/SpecCard.jsx
try { (() => {
function SpecCard({
  title = '// spec',
  rows = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "spec-card"
  }, /*#__PURE__*/React.createElement("h3", null, title), rows.map(r => /*#__PURE__*/React.createElement("div", {
    className: "spec-row",
    key: r.label
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, r.label), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, r.value))));
}
Object.assign(__ds_scope, { SpecCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/SpecCard.jsx", error: String((e && e.message) || e) }); }

// components/content/WhyCard.jsx
try { (() => {
function WhyCard({
  icon,
  title,
  children,
  consequence
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "why-card"
  }, icon && /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, icon), /*#__PURE__*/React.createElement("h3", null, title), /*#__PURE__*/React.createElement("p", null, children), consequence && /*#__PURE__*/React.createElement("div", {
    className: "conseq"
  }, consequence));
}
Object.assign(__ds_scope, { WhyCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/content/WhyCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Badge({
  children,
  tone,
  solid,
  square,
  led,
  className = '',
  ...rest
}) {
  const cls = ['badge', tone, solid ? 'solid' : '', square ? 'square' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), led && /*#__PURE__*/React.createElement("span", {
    className: "led"
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  children,
  variant = 'ghost',
  size,
  block,
  disabled,
  href,
  onClick,
  type = 'button',
  brackets = true,
  arrow,
  className = '',
  ...rest
}) {
  const cls = ['btn', variant, size, block ? 'block' : '', className].filter(Boolean).join(' ');
  const label = brackets ? /*#__PURE__*/React.createElement(React.Fragment, null, "[\xA0", children, arrow ? ' ' + arrow : '', "\xA0]") : /*#__PURE__*/React.createElement(React.Fragment, null, children, arrow ? ' ' + arrow : '');
  if (href && !disabled) return /*#__PURE__*/React.createElement("a", _extends({
    className: cls,
    href: href
  }, rest), label);
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    type: type,
    disabled: disabled,
    onClick: onClick
  }, rest), label);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Chip({
  children,
  active,
  onClick,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    className: ['chip', active ? 'active' : '', className].filter(Boolean).join(' '),
    onClick: onClick
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Kbd.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Kbd({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("kbd", _extends({
    className: ['kbd', className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Kbd });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/core/Panel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Panel({
  children,
  title,
  variant,
  interactive,
  className = '',
  ...rest
}) {
  const cls = ['panel', variant, interactive ? 'interactive' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), title && /*#__PURE__*/React.createElement("div", {
    className: "panel-h"
  }, /*#__PURE__*/React.createElement("h3", null, title)), children);
}
Object.assign(__ds_scope, { Panel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Panel.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  onClose,
  title,
  barTitle,
  children,
  actions
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'dlg-back' + (open ? ' open' : ''),
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "dlg",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dlg-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, barTitle || 'confirm'), /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onClose,
    "aria-label": "close"
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "dlg-body"
  }, title && /*#__PURE__*/React.createElement("h3", null, title), typeof children === 'string' ? /*#__PURE__*/React.createElement("p", null, children) : children), actions && /*#__PURE__*/React.createElement("div", {
    className: "dlg-foot"
  }, actions)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ProgressBar.jsx
try { (() => {
function ProgressBar({
  value = 0,
  fixed
}) {
  const style = {
    width: Math.max(0, Math.min(100, value)) + '%'
  };
  if (fixed) return /*#__PURE__*/React.createElement("div", {
    className: "progress",
    style: style
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 2,
      background: 'var(--border)',
      borderRadius: 2,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "progress",
    style: {
      ...style,
      position: 'static',
      boxShadow: 'var(--glow-btn)'
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  tone,
  icon,
  title,
  children,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ['toast', tone].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("span", {
    className: "ticon"
  }, icon || '›'), /*#__PURE__*/React.createElement("div", {
    className: "tbody"
  }, title && /*#__PURE__*/React.createElement("strong", null, title), children && /*#__PURE__*/React.createElement("span", null, children)), onClose && /*#__PURE__*/React.createElement("button", {
    className: "tx",
    onClick: onClose,
    "aria-label": "dismiss"
  }, "\u2715"));
}
function ToastStack({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "toast-stack"
  }, children);
}
Object.assign(__ds_scope, { Toast, ToastStack });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "tip-wrap",
    tabIndex: 0
  }, children, /*#__PURE__*/React.createElement("span", {
    className: "tip-bubble",
    role: "tooltip"
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  sublabel,
  radio,
  checked,
  onChange,
  disabled,
  name,
  value
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "check"
  }, /*#__PURE__*/React.createElement("input", {
    type: radio ? 'radio' : 'checkbox',
    checked: checked,
    onChange: onChange,
    disabled: disabled,
    name: name,
    value: value
  }), /*#__PURE__*/React.createElement("span", {
    className: 'box' + (radio ? ' round' : '')
  }, checked ? radio ? '●' : '✓' : ''), /*#__PURE__*/React.createElement("span", {
    className: "ctext"
  }, label, sublabel && /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, sublabel)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function Field({
  label,
  required,
  hint,
  error,
  children
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, label && /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, label, required && /*#__PURE__*/React.createElement("span", {
    className: "req"
  }, " *")), children, error ? /*#__PURE__*/React.createElement("span", {
    className: "field-error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "field-hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  prompt,
  invalid,
  size,
  multiline,
  className = '',
  ...rest
}) {
  const cls = ['input', size === 'lg' ? 'mono-lg' : '', invalid ? 'invalid' : '', className].filter(Boolean).join(' ');
  const control = multiline ? /*#__PURE__*/React.createElement("textarea", _extends({
    className: cls
  }, rest)) : /*#__PURE__*/React.createElement("input", _extends({
    className: cls
  }, rest));
  if (!prompt) return control;
  return /*#__PURE__*/React.createElement("span", {
    className: "input-prompt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ps"
  }, prompt), control);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  options = [],
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "select-wrap"
  }, /*#__PURE__*/React.createElement("select", _extends({
    className: ['select', className].filter(Boolean).join(' ')
  }, rest), options.map(o => typeof o === 'string' ? /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o) : /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  label,
  checked,
  onChange,
  disabled,
  showState
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: "switch"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: checked,
    onChange: onChange,
    disabled: disabled
  }), /*#__PURE__*/React.createElement("span", {
    className: "track"
  }), showState && /*#__PURE__*/React.createElement("span", {
    className: "sw-state"
  }, checked ? 'on' : 'off'), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumbs.jsx
try { (() => {
function Breadcrumbs({
  items = [],
  current
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "crumbs"
  }, items.map((it, i) => /*#__PURE__*/React.createElement("span", {
    key: it.href + i
  }, /*#__PURE__*/React.createElement("a", {
    href: it.href
  }, it.label), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"))), current && /*#__PURE__*/React.createElement("span", {
    className: "cur"
  }, current));
}
Object.assign(__ds_scope, { Breadcrumbs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumbs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
function Footer({
  blurb,
  columns = [],
  signature = 'Freedom can only live at home.',
  meta,
  brand = 'SHFF'
}) {
  return /*#__PURE__*/React.createElement("footer", null, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-col foot-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk"
  }, brand)), blurb && /*#__PURE__*/React.createElement("p", null, blurb)), columns.map(col => /*#__PURE__*/React.createElement("div", {
    className: "foot-col",
    key: col.title
  }, /*#__PURE__*/React.createElement("h4", null, col.title), col.links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.href + l.label,
    href: l.href,
    target: l.external ? '_blank' : undefined,
    rel: l.external ? 'noopener' : undefined
  }, l.label))))), /*#__PURE__*/React.createElement("div", {
    className: "foot-bottom"
  }, /*#__PURE__*/React.createElement("span", {
    className: "foot-sig"
  }, signature), meta && /*#__PURE__*/React.createElement("span", {
    className: "foot-meta"
  }, meta))));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MobileMenu.jsx
try { (() => {
function MobileMenu({
  items = [],
  open
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: 'mobile-menu' + (open ? ' open' : '')
  }, items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it.href,
    href: it.href
  }, it.label)));
}
Object.assign(__ds_scope, { MobileMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MobileMenu.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  items = [],
  value,
  onChange,
  boxed
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'tabs' + (boxed ? ' boxed' : ''),
    role: "tablist"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    role: "tab",
    "aria-selected": value === it.id,
    className: 'tab' + (value === it.id ? ' active' : ''),
    onClick: () => onChange && onChange(it.id)
  }, it.label, it.count != null && /*#__PURE__*/React.createElement("span", {
    className: "tcount"
  }, it.count))));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Topbar.jsx
try { (() => {
function Topbar({
  brand = 'SHFF',
  brandSuffix = 'self_hosted_freedom',
  items = [],
  cta,
  current,
  onBurger,
  href = 'index.html'
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: href
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk"
  }, brand), brandSuffix && /*#__PURE__*/React.createElement("span", {
    className: "hide-sm"
  }, brandSuffix)), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, items.map(it => /*#__PURE__*/React.createElement("a", {
    key: it.href,
    href: it.href,
    style: it.href === current ? {
      color: 'var(--accent)'
    } : undefined
  }, it.label)), cta && /*#__PURE__*/React.createElement("a", {
    className: "tg",
    href: cta.href,
    target: "_blank",
    rel: "noopener"
  }, cta.label)), /*#__PURE__*/React.createElement("button", {
    className: "burger",
    onClick: onBurger,
    "aria-label": "menu"
  }, "\u2261")));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Topbar.jsx", error: String((e && e.message) || e) }); }

// components/terminal/Caret.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Caret({
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['cursor', className].filter(Boolean).join(' ')
  }, rest));
}
Object.assign(__ds_scope, { Caret });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/Caret.jsx", error: String((e && e.message) || e) }); }

// components/terminal/PtyConsole.jsx
try { (() => {
function PtyConsole({
  open,
  onClose,
  lines = [],
  onSubmit,
  ps1 = 'mikhail@homelab:~$',
  title = 'mikhail@homelab: ~ (ctrl+~ to toggle)'
}) {
  const [value, setValue] = React.useState('');
  const submit = e => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit && onSubmit(value);
    setValue('');
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: 'pty-back' + (open ? ' open' : ''),
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: 'pty' + (open ? ' open' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "pty-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, title), /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onClose,
    "aria-label": "close"
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "pty-out pty-scroll"
  }, lines.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: l.echo ? 'echo' : undefined
  }, l.text))), /*#__PURE__*/React.createElement("form", {
    className: "pty-input-row",
    onSubmit: submit
  }, /*#__PURE__*/React.createElement("span", {
    className: "ps1"
  }, ps1), /*#__PURE__*/React.createElement("input", {
    className: "pty-input",
    value: value,
    onChange: e => setValue(e.target.value),
    autoComplete: "off",
    spellCheck: "false"
  }))));
}
Object.assign(__ds_scope, { PtyConsole });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/PtyConsole.jsx", error: String((e && e.message) || e) }); }

// components/terminal/TerminalWindow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TerminalWindow({
  title = 'mikhail@homelab: ~',
  children,
  minHeight,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['term', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "term-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "term-title"
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "term-body",
    style: minHeight ? {
      minHeight
    } : undefined
  }, children));
}
Object.assign(__ds_scope, { TerminalWindow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/TerminalWindow.jsx", error: String((e && e.message) || e) }); }

// globe.js
try { (() => {
/* ============================================================
   Wireframe globe — three.js
   meridians + parallels + pulsing nodes, drag to rotate,
   click a node -> philosophical quote.
   Degrades on small screens / reduced motion.
   ============================================================ */
(function () {
  const mount = document.getElementById('globe');
  if (!mount || typeof THREE === 'undefined') return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 680px)').matches;
  const ACCENT = new THREE.Color(0x33ff99);
  const DIM = new THREE.Color(0x1c5c3a);
  const quotes = ['Твои данные. Твои сервисы. Твоё железо.', 'Свобода в интернете заканчивается там, где всё твоё лежит не у тебя.', 'Вопрос не «а вдруг понадобится», а «когда именно понадобится мне».', 'Один диск это не хранилище данных, это устройство для потери данных.', 'Цифровая независимость начинается дома.', 'Забери у корпораций обратно то, что и так твоё.', 'Контроль над данными перестал быть хобби. Теперь это практика.', 'Freedom can only live at home.'];

  // node placements [lat, lon, label]
  const nodes = [[40, 20, 'дом'], [12, -60, 'твой бэкап'], [55, 95, 'твоя медиатека'], [-25, 130, 'твои заметки'], [-35, -55, 'твои фото'], [62, -120, 'твой VPN'], [-10, 40, 'твоя свобода'], [30, 165, 'твой сервер']];
  const W = mount.clientWidth || 440;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.setSize(W, W, false);
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);
  const root = new THREE.Group();
  scene.add(root);
  root.rotation.x = 0.42;
  const R = 2;

  // dark translucent sphere so back-facing nodes/lines dim out
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R * 0.992, 48, 48), new THREE.MeshBasicMaterial({
    color: 0x081109,
    transparent: true,
    opacity: 0.92
  }));
  root.add(shell);

  // faint inner glow sphere
  const glow = new THREE.Mesh(new THREE.SphereGeometry(R * 0.6, 24, 24), new THREE.MeshBasicMaterial({
    color: 0x0c3a24,
    transparent: true,
    opacity: 0.18
  }));
  root.add(glow);
  function ll(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x1f6b44,
    transparent: true,
    opacity: 0.55
  });
  const lineMatHi = new THREE.LineBasicMaterial({
    color: 0x2a8f5c,
    transparent: true,
    opacity: 0.7
  });

  // parallels
  for (let lat = -75; lat <= 75; lat += 15) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 6) pts.push(ll(lat, lon, R));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    root.add(new THREE.Line(g, lat === 0 ? lineMatHi : lineMat));
  }
  // meridians
  for (let lon = 0; lon < 360; lon += 15) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 4) pts.push(ll(lat, lon, R));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    root.add(new THREE.Line(g, lon % 90 === 0 ? lineMatHi : lineMat));
  }

  // nodes
  const nodeGroup = new THREE.Group();
  root.add(nodeGroup);
  const nodeMeshes = [];
  nodes.forEach((n, i) => {
    const pos = ll(n[0], n[1], R * 1.012);
    const home = i === 0;
    const core = new THREE.Mesh(new THREE.SphereGeometry(home ? 0.075 : 0.05, 14, 14), new THREE.MeshBasicMaterial({
      color: ACCENT
    }));
    core.position.copy(pos);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(home ? 0.16 : 0.12, 16, 16), new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.25
    }));
    halo.position.copy(pos);
    nodeGroup.add(core, halo);
    core.userData = {
      halo,
      label: n[2],
      phase: Math.random() * Math.PI * 2,
      home,
      base: home ? 0.075 : 0.05
    };
    nodeMeshes.push(core);
  });

  // tooltip + quote elements
  const tip = document.getElementById('globe-tip');
  const quoteEl = document.getElementById('globe-quote');
  const raycaster = new THREE.Raycaster();
  raycaster.params.Points = {
    threshold: 0.1
  };
  const mouse = new THREE.Vector2(-2, -2);
  let hovered = null;
  let qi = -1;

  // drag rotation
  let dragging = false,
    lastX = 0,
    lastY = 0,
    velX = 0.0024,
    velY = 0;
  let downX = 0,
    downY = 0,
    moved = false;
  function pointerPos(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: cx - r.left,
      y: cy - r.top,
      rect: r
    };
  }
  mount.addEventListener('pointerdown', e => {
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    downX = e.clientX;
    downY = e.clientY;
    mount.setPointerCapture && mount.setPointerCapture(e.pointerId);
  });
  window.addEventListener('pointerup', e => {
    if (dragging && !moved) handleClick(e);
    dragging = false;
  });
  mount.addEventListener('pointermove', e => {
    const p = pointerPos(e);
    mouse.x = p.x / p.rect.width * 2 - 1;
    mouse.y = -(p.y / p.rect.height) * 2 + 1;
    if (dragging) {
      const dx = e.clientX - lastX,
        dy = e.clientY - lastY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true;
      root.rotation.y += dx * 0.006;
      root.rotation.x += dy * 0.006;
      root.rotation.x = Math.max(-0.9, Math.min(1.1, root.rotation.x));
      velX = dx * 0.0006;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  mount.addEventListener('pointerleave', () => {
    mouse.x = -2;
    mouse.y = -2;
  });
  function handleClick() {
    if (hovered) {
      qi = (qi + 1) % quotes.length;
      quoteEl.textContent = quotes[qi];
      quoteEl.classList.add('show');
    }
  }

  // resize
  function resize() {
    const w = mount.clientWidth || 440;
    renderer.setSize(w, w, false);
  }
  window.addEventListener('resize', resize);
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.016;
    if (!dragging) {
      root.rotation.y += reduced ? 0 : 0.0016 + velX;
      velX *= 0.96;
      if (Math.abs(velX) < 0.0006) velX = reduced ? 0 : 0.0018 * Math.sign(velX || 1) * 0;
    }

    // pulse nodes
    nodeMeshes.forEach(m => {
      const u = m.userData;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + u.phase);
      u.halo.scale.setScalar(1 + pulse * 0.7);
      u.halo.material.opacity = 0.12 + pulse * (u.home ? 0.32 : 0.2);
    });

    // hover detection
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(nodeMeshes, false);
    const hit = hits.length ? hits[0].object : null;
    if (hit !== hovered) {
      if (hovered) hovered.scale.setScalar(1);
      hovered = hit;
      if (hovered) {
        hovered.scale.setScalar(1.5);
        tip.textContent = hovered.userData.label;
        mount.style.cursor = 'pointer';
      } else {
        tip.style.opacity = 0;
        mount.style.cursor = '';
      }
    }
    if (hovered) {
      const v = hovered.position.clone();
      v.applyMatrix4(root.matrixWorld).project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      // only show if facing camera (z in clip space)
      tip.style.left = (v.x * 0.5 + 0.5) * rect.width + 'px';
      tip.style.top = (-v.y * 0.5 + 0.5) * rect.height + 'px';
      tip.style.opacity = 1;
    }
    renderer.render(scene, camera);
  }
  animate();
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "globe.js", error: String((e && e.message) || e) }); }

// site.js
try { (() => {
/* ============================================================
   Site behaviour: typewriter hero, mobile menu, Ctrl+~ pty
   ============================================================ */
(function () {
  /* ---------- typewriter hero ---------- */
  const term = document.getElementById('term-body');
  if (term) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // [text, className]
    const seq = [['$ ', 'prompt'], ['whoami\n', 'cmd'], ['> ', 'prompt'], ['self-hosted freedom foundation\n\n', 'out'], ['$ ', 'prompt'], ['cat ./mission.txt\n', 'cmd'], ['> ', 'prompt'], ['Твои данные. Твои сервисы. Твоё железо.\n', 'out'], ['> ', 'prompt'], ['Цифровая независимость начинается дома.\n\n', 'out'], ['$ ', 'prompt'], ['./join --channel telegram\n', 'cmd']];
    if (reduced) {
      term.innerHTML = seq.map(([txt, cls]) => `<span class="${cls === 'prompt' ? 'prompt' : 'out'}">${esc(txt)}</span>`).join('') + '<span class="cursor"></span>';
    } else {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      term.appendChild(cursor);
      let si = 0,
        ci = 0,
        cur = null;
      function step() {
        if (si >= seq.length) return;
        const [txt, cls] = seq[si];
        if (ci === 0) {
          cur = document.createElement('span');
          cur.className = cls === 'prompt' ? 'prompt' : 'out';
          term.insertBefore(cur, cursor);
        }
        cur.textContent += txt[ci];
        ci++;
        if (ci >= txt.length) {
          si++;
          ci = 0;
        }
        const isPrompt = cls === 'prompt';
        const delay = isPrompt ? 24 : txt[ci - 1] === '\n' ? 140 : 16 + Math.random() * 26;
        setTimeout(step, delay);
      }
      setTimeout(step, 380);
    }
  }
  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }

  /* ---------- mobile menu ---------- */
  const burger = document.getElementById('burger');
  const mmenu = document.getElementById('mobile-menu');
  if (burger && mmenu) {
    burger.addEventListener('click', () => mmenu.classList.toggle('open'));
    mmenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mmenu.classList.remove('open')));
  }

  /* ---------- Ctrl+~ pseudo terminal ---------- */
  const back = document.getElementById('pty-back');
  const pty = document.getElementById('pty');
  const out = document.getElementById('pty-out');
  const input = document.getElementById('pty-input');
  if (!pty) return;
  function open() {
    back.classList.add('open');
    pty.classList.add('open');
    setTimeout(() => input.focus(), 60);
  }
  function close() {
    back.classList.remove('open');
    pty.classList.remove('open');
  }
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
      e.preventDefault();
      pty.classList.contains('open') ? close() : open();
    }
    if (e.key === 'Escape' && pty.classList.contains('open')) close();
  });
  document.getElementById('pty-x').addEventListener('click', close);
  back.addEventListener('click', close);
  const boot = new Date();
  function uptime() {
    const days = 42,
      h = 13,
      m = (Math.floor((Date.now() - boot) / 60000) + 7) % 60;
    return `up ${days} days, ${h}:${String(m).padStart(2, '0')}, 1 user, load average: 0.04, 0.07, 0.02`;
  }
  const cmds = {
    help: () => 'available: whoami, uptime, cowsay <text>, sl, neofetch, ls, clear, exit',
    whoami: () => 'mikhail',
    uptime: () => uptime(),
    ls: () => 'home/  wiki/  posts/  manifesto/  about/  mission.txt',
    'cat mission.txt': () => 'Твои данные. Твои сервисы. Твоё железо.',
    pwd: () => '/home/mikhail',
    date: () => new Date().toString(),
    neofetch: () => ['       _nnnn_      mikhail@homelab', "      dGGGGMMb     -----------------", "     @p~qp~~qMb    OS:    Debian 12 (stable)", "     M|@||@) M|    Host:  Intel N100 mini-pc", "     @,----.JM|    Uptime: 42 days", "    JS^\\__/  qKL   Shell: bash 5.2", "   dZP        qKRb Docker: 14 services up", "  dZP          qKKb Mem:   1.9G / 16G", ' fZP            SMMb', ' HZM            MMMM   Freedom can only live at home.'].join('\n'),
    sl: () => ['      ====        ________                ___________', '  _D _|  |_______/        \\__I_I_____===__|_________|', '   |(_)---  |   H\\________/ |   |        =|___ ___|', '   /     |  |   H  |  |     |   |         ||_| |_||', '  |      |  |   H  |__--------------------| [___] |', '  | ________|___H__/__|_____/[][]~\\_______|       |', '  |/ |   |-----------I_____I [][] []  D   |=======|__', '  choo choo  (поезд проехал, ты всё ещё за NAT)'].join('\n'),
    clear: () => {
      out.innerHTML = '';
      return null;
    },
    exit: () => {
      close();
      return null;
    }
  };
  function print(html, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }
  print('Self Hosted Freedom — pseudo-shell. type <span class="echo">help</span> for commands.', 'muted');
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    print('<span class="echo">mikhail@homelab:~$</span> ' + esc(raw));
    let res;
    if (raw.startsWith('cowsay ')) {
      res = cowsay(raw.slice(7));
    } else if (cmds[raw]) {
      res = cmds[raw]();
    } else if (cmds[raw.split(' ')[0]] && raw.split(' ').length === 1) {
      res = cmds[raw]();
    } else {
      res = `bash: ${esc(raw.split(' ')[0])}: command not found`;
    }
    if (res != null) print('<span style="white-space:pre">' + (res === uptime() ? esc(res) : escPre(res)) + '</span>');
  });
  function escPre(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  }
  function cowsay(text) {
    text = text || 'freedom';
    const top = ' ' + '_'.repeat(text.length + 2);
    const bot = ' ' + '-'.repeat(text.length + 2);
    return [top, '< ' + text + ' >', bot, '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||'].join('\n');
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "site.js", error: String((e && e.message) || e) }); }

// ui_kits/dock/DockApp.jsx
try { (() => {
/* SHFF Dock — UI kit screens. Composes the DS classes from styles.css. */

const DOCK_SERVICES = [{
  id: 'navidrome',
  name: 'Navidrome',
  cat: 'медиа',
  port: 4533,
  ver: '0.53.3',
  state: 'running',
  up: '41д 6ч',
  cpu: '0.4%',
  ram: '112 MB',
  desc: 'Музыкальный сервер с Subsonic API'
}, {
  id: 'qbittorrent',
  name: 'qBittorrent',
  cat: 'медиа',
  port: 8080,
  ver: '4.6.4',
  state: 'running',
  up: '41д 6ч',
  cpu: '1.9%',
  ram: '304 MB',
  desc: 'Торрент-клиент с веб-интерфейсом'
}, {
  id: 'picoshare',
  name: 'PicoShare',
  cat: 'файлы',
  port: 3001,
  ver: '1.4.2',
  state: 'running',
  up: '12д 2ч',
  cpu: '0.1%',
  ram: '28 MB',
  desc: 'Простой файлообменник'
}, {
  id: 'vaultwarden',
  name: 'Vaultwarden',
  cat: 'безопасность',
  port: 8222,
  ver: '1.30.5',
  state: 'updating',
  up: '—',
  cpu: '0.8%',
  ram: '96 MB',
  desc: 'Менеджер паролей, совместимый с Bitwarden'
}, {
  id: 'uptime-kuma',
  name: 'Uptime Kuma',
  cat: 'мониторинг',
  port: 3002,
  ver: '1.23.11',
  state: 'running',
  up: '41д 6ч',
  cpu: '0.6%',
  ram: '148 MB',
  desc: 'Мониторинг доступности сервисов'
}, {
  id: 'jellyfin',
  name: 'Jellyfin',
  cat: 'медиа',
  port: 8096,
  ver: '10.9.1',
  state: 'failed',
  up: '—',
  cpu: '—',
  ram: '—',
  desc: 'Медиасервер для фильмов и сериалов'
}];
const DOCK_CATALOG = [{
  id: 'immich',
  name: 'Immich',
  cat: 'медиа',
  desc: 'Фото и видео с распознаванием лиц. Замена Google Photos.',
  pulls: '2.4M',
  size: '1.2 GB'
}, {
  id: 'paperless',
  name: 'Paperless-ngx',
  cat: 'документы',
  desc: 'Архив документов с OCR и полнотекстовым поиском.',
  pulls: '890K',
  size: '640 MB'
}, {
  id: 'gitea',
  name: 'Gitea',
  cat: 'разработка',
  desc: 'Лёгкий self-hosted git-хостинг с CI.',
  pulls: '1.1M',
  size: '210 MB'
}, {
  id: 'adguard',
  name: 'AdGuard Home',
  cat: 'сеть',
  desc: 'DNS-фильтр рекламы и трекеров на всю сеть.',
  pulls: '3.2M',
  size: '58 MB'
}, {
  id: 'nextcloud',
  name: 'Nextcloud',
  cat: 'файлы',
  desc: 'Файлы, календарь и заметки. Своё облако целиком.',
  pulls: '4.8M',
  size: '1.8 GB'
}, {
  id: 'homarr',
  name: 'Homarr',
  cat: 'дашборд',
  desc: 'Единая панель со всеми сервисами и виджетами.',
  pulls: '410K',
  size: '180 MB'
}];
const DOCK_LOG = [{
  p: '$',
  t: 'shff-dock deploy vaultwarden --port 8222'
}, {
  o: '→ pulling vaultwarden/server:1.30.5'
}, {
  d: '   layer 1/6 ████████████ done  ·  layer 2/6 ████████████ done'
}, {
  d: '   layer 3/6 ████████████ done  ·  layer 4/6 ████████░░░░ 68%'
}, {
  o: '→ writing compose file ./stacks/vaultwarden/docker-compose.yml'
}, {
  o: '→ reserving port 8222'
}, {
  d: '   host check: port free, no conflict'
}, {
  o: '→ creating volume vaultwarden_data'
}, {
  p: '$',
  t: 'docker compose up -d'
}, {
  d: '   [+] Running 2/2 · network created · container started'
}, {
  ok: '✓ vaultwarden доступен на http://homelab.local:8222'
}];
function DockBrand() {
  return /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: "#",
    onClick: e => e.preventDefault()
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk"
  }, "DOCK"), /*#__PURE__*/React.createElement("span", {
    className: "hide-sm"
  }, "shff_dock"));
}
function StateBadge({
  state
}) {
  const map = {
    running: {
      tone: 'ok',
      label: 'запущен'
    },
    updating: {
      tone: 'warn',
      label: 'обновление'
    },
    failed: {
      tone: 'danger',
      label: 'упал'
    },
    stopped: {
      tone: null,
      label: 'остановлен'
    }
  };
  const m = map[state] || map.stopped;
  return /*#__PURE__*/React.createElement("span", {
    className: 'badge ' + (m.tone || '')
  }, m.tone && /*#__PURE__*/React.createElement("span", {
    className: "led"
  }), m.label);
}
function ServiceCard({
  svc,
  onOpen,
  onToggle
}) {
  const on = svc.state === 'running' || svc.state === 'updating';
  return /*#__PURE__*/React.createElement("div", {
    className: "panel interactive",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'var(--sans)',
      fontSize: 16.5,
      fontWeight: 600,
      color: 'var(--ink-bright)'
    }
  }, svc.name), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--faint)',
      fontSize: 12.5,
      marginTop: 3
    }
  }, ":", svc.port, " \xB7 v", svc.ver, " \xB7 ", svc.cat)), /*#__PURE__*/React.createElement(StateBadge, {
    state: svc.state
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--muted)',
      fontSize: 13.5,
      lineHeight: 1.5,
      flex: 1
    }
  }, svc.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      fontSize: 12,
      color: 'var(--faint)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", null, "cpu ", svc.cpu), /*#__PURE__*/React.createElement("span", null, "ram ", svc.ram), /*#__PURE__*/React.createElement("span", null, "up ", svc.up)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderTop: '1px solid var(--border)',
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "switch",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: on,
    onChange: () => onToggle(svc.id)
  }), /*#__PURE__*/React.createElement("span", {
    className: "track"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sw-state",
    style: on ? {
      color: 'var(--accent)'
    } : undefined
  }, on ? 'on' : 'off')), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      marginLeft: 'auto'
    },
    onClick: () => onOpen(svc)
  }, "[\xA0\u043E\u0442\u043A\u0440\u044B\u0442\u044C\xA0]")));
}
function CatalogCard({
  item,
  onInstall
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "panel interactive",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'var(--sans)',
      fontSize: 16.5,
      fontWeight: 600,
      color: 'var(--ink-bright)'
    }
  }, item.name), /*#__PURE__*/React.createElement("span", {
    className: "badge square",
    style: {
      marginLeft: 'auto'
    }
  }, item.cat)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: 'var(--muted)',
      fontSize: 13.5,
      lineHeight: 1.55,
      flex: 1
    }
  }, item.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      fontSize: 12.5,
      color: 'var(--faint)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2193 ", item.pulls), /*#__PURE__*/React.createElement("span", null, item.size)), /*#__PURE__*/React.createElement("button", {
    className: "btn primary sm block",
    onClick: () => onInstall(item)
  }, "[\xA0\u0443\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C\xA0]"));
}
function HostPanel() {
  return /*#__PURE__*/React.createElement("div", {
    className: "spec-card"
  }, /*#__PURE__*/React.createElement("h3", null, "// homelab"), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0445\u043E\u0441\u0442"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "homelab.local")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "cpu"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "N100 \xB7 12%")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "ram"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "3.1 / 16 GB")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0434\u0438\u0441\u043A"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "1.9 / 4 TB")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "uptime"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "41\u0434 6\u0447")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0441\u0435\u0440\u0432\u0438\u0441\u044B"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "5 / 6 up")));
}
function LogView() {
  return /*#__PURE__*/React.createElement("div", {
    className: "term"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "term-title"
  }, "shff-dock \xB7 deploy log")), /*#__PURE__*/React.createElement("div", {
    className: "term-body",
    style: {
      minHeight: 300,
      fontSize: 13.5
    }
  }, DOCK_LOG.map((l, i) => /*#__PURE__*/React.createElement("div", {
    className: "line",
    key: i
  }, l.p && /*#__PURE__*/React.createElement("span", {
    className: "prompt"
  }, l.p, " "), l.t && /*#__PURE__*/React.createElement("span", {
    className: "out"
  }, l.t), l.o && /*#__PURE__*/React.createElement("span", {
    className: "out"
  }, l.o), l.d && /*#__PURE__*/React.createElement("span", {
    className: "out dim"
  }, l.d), l.ok && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--accent)',
      textShadow: 'var(--glow-text)'
    }
  }, l.ok))), /*#__PURE__*/React.createElement("div", {
    className: "line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "prompt"
  }, "$ "), /*#__PURE__*/React.createElement("span", {
    className: "cursor"
  }))));
}
function InstallDialog({
  item,
  onClose,
  onDone
}) {
  const [port, setPort] = React.useState('8080');
  const [net, setNet] = React.useState('bridge');
  const [auto, setAuto] = React.useState(true);
  const [proxy, setProxy] = React.useState(false);
  const conflict = port === '8080';
  return /*#__PURE__*/React.createElement("div", {
    className: 'dlg-back' + (item ? ' open' : ''),
    onClick: onClose
  }, item && /*#__PURE__*/React.createElement("div", {
    className: "dlg",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dlg-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "t"
  }, "shff-dock deploy ", item.id), /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onClose,
    "aria-label": "close"
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "dlg-body"
  }, /*#__PURE__*/React.createElement("h3", null, "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C ", item.name, "?"), /*#__PURE__*/React.createElement("p", null, "Dock \u043D\u0430\u043F\u0438\u0448\u0435\u0442 compose-\u0444\u0430\u0439\u043B, \u0437\u0430\u0440\u0435\u0437\u0435\u0440\u0432\u0438\u0440\u0443\u0435\u0442 \u043F\u043E\u0440\u0442 \u0438 \u043F\u043E\u0434\u043D\u0438\u043C\u0435\u0442 \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440. \u041D\u0438\u0447\u0435\u0433\u043E \u0432\u0440\u0443\u0447\u043D\u0443\u044E."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 14,
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "\u043F\u043E\u0440\u0442", /*#__PURE__*/React.createElement("span", {
    className: "req"
  }, " *")), /*#__PURE__*/React.createElement("input", {
    className: 'input' + (conflict ? ' invalid' : ''),
    value: port,
    onChange: e => setPort(e.target.value)
  }), conflict ? /*#__PURE__*/React.createElement("span", {
    className: "field-error"
  }, "\u0437\u0430\u043D\u044F\u0442 qbittorrent") : /*#__PURE__*/React.createElement("span", {
    className: "field-hint"
  }, "\u0441\u0432\u043E\u0431\u043E\u0434\u0435\u043D")), /*#__PURE__*/React.createElement("label", {
    className: "field"
  }, /*#__PURE__*/React.createElement("span", {
    className: "field-label"
  }, "\u0441\u0435\u0442\u044C"), /*#__PURE__*/React.createElement("span", {
    className: "select-wrap"
  }, /*#__PURE__*/React.createElement("select", {
    className: "select",
    value: net,
    onChange: e => setNet(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "bridge"
  }, "bridge"), /*#__PURE__*/React.createElement("option", {
    value: "host"
  }, "host"), /*#__PURE__*/React.createElement("option", {
    value: "macvlan"
  }, "macvlan"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: auto,
    onChange: e => setAuto(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "box"
  }, auto ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    className: "ctext"
  }, "\u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A", /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "\u043F\u043E\u0434\u043D\u0438\u043C\u0430\u0442\u044C \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440 \u043F\u043E\u0441\u043B\u0435 \u0440\u0435\u0431\u0443\u0442\u0430"))), /*#__PURE__*/React.createElement("label", {
    className: "check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: proxy,
    onChange: e => setProxy(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "box"
  }, proxy ? '✓' : ''), /*#__PURE__*/React.createElement("span", {
    className: "ctext"
  }, "\u0432\u044B\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u043D\u0430\u0440\u0443\u0436\u0443", /*#__PURE__*/React.createElement("span", {
    className: "sub"
  }, "reverse proxy + TLS-\u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442"))))), /*#__PURE__*/React.createElement("div", {
    className: "dlg-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: onClose
  }, "[\xA0\u043E\u0442\u043C\u0435\u043D\u0430\xA0]"), /*#__PURE__*/React.createElement("button", {
    className: "btn primary",
    disabled: conflict,
    onClick: () => onDone(item, port)
  }, "[\xA0\u0440\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C\xA0]"))));
}
function DockApp() {
  const [tab, setTab] = React.useState('running');
  const [services, setServices] = React.useState(DOCK_SERVICES);
  const [installing, setInstalling] = React.useState(null);
  const [toasts, setToasts] = React.useState([]);
  const [query, setQuery] = React.useState('');
  const pushToast = t => {
    const id = Date.now() + Math.random();
    setToasts(ts => [...ts, {
      ...t,
      id
    }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 4200);
  };
  const toggle = id => {
    setServices(ss => ss.map(s => {
      if (s.id !== id) return s;
      const next = s.state === 'running' ? 'stopped' : 'running';
      pushToast(next === 'running' ? {
        title: s.name + ' запущен',
        body: ':' + s.port + ' · 1.2s'
      } : {
        tone: 'note',
        title: s.name + ' остановлен',
        body: 'контейнер выгружен, тома целы'
      });
      return {
        ...s,
        state: next,
        up: next === 'running' ? '0м' : '—'
      };
    }));
  };
  const install = (item, port) => {
    setInstalling(null);
    pushToast({
      title: item.name + ' развёрнут',
      body: 'порт ' + port + ' · 8.4s · автозапуск включён'
    });
    setServices(ss => [...ss, {
      id: item.id,
      name: item.name,
      cat: item.cat,
      port: Number(port),
      ver: 'latest',
      state: 'running',
      up: '0м',
      cpu: '0.2%',
      ram: '64 MB',
      desc: item.desc
    }]);
    setTab('running');
  };
  const shown = services.filter(s => !query || s.name.toLowerCase().includes(query.toLowerCase()));
  const catalog = DOCK_CATALOG.filter(c => !services.some(s => s.id === c.id));
  const nav = [{
    label: '~/services',
    id: 'running'
  }, {
    label: '~/catalog',
    id: 'catalog'
  }, {
    label: '~/logs',
    id: 'logs'
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scanlines"
  }), /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement(DockBrand, null), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, nav.map(n => /*#__PURE__*/React.createElement("a", {
    key: n.id,
    href: "#",
    onClick: e => {
      e.preventDefault();
      setTab(n.id);
    },
    style: tab === n.id ? {
      color: 'var(--accent)'
    } : undefined
  }, n.label)), /*#__PURE__*/React.createElement("a", {
    className: "tg",
    href: "#",
    onClick: e => e.preventDefault()
  }, "homelab.local \u2197")))), /*#__PURE__*/React.createElement("main", {
    className: "page",
    style: {
      paddingBottom: 60
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, "$ shff-dock status"), /*#__PURE__*/React.createElement("h1", null, tab === 'catalog' ? 'Каталог сервисов' : tab === 'logs' ? 'Журнал' : 'Твои сервисы'), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, tab === 'catalog' ? /*#__PURE__*/React.createElement(React.Fragment, null, "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 \u043E\u0431\u0440\u0430\u0437\u044B \u0441 \u0433\u043E\u0442\u043E\u0432\u044B\u043C\u0438 compose-\u0444\u0430\u0439\u043B\u0430\u043C\u0438. \u041F\u043E\u0440\u0442, \u0441\u0435\u0442\u044C, \u0430\u0432\u0442\u043E\u0437\u0430\u043F\u0443\u0441\u043A \u2014 ", /*#__PURE__*/React.createElement("span", {
    className: "accent"
  }, "\u0438 \u0432\u0441\u0451"), ".") : tab === 'logs' ? /*#__PURE__*/React.createElement(React.Fragment, null, "\u0412\u0441\u0451, \u0447\u0442\u043E Dock \u0441\u0434\u0435\u043B\u0430\u043B \u0437\u0430 \u0442\u0435\u0431\u044F, \u0434\u043E\u0441\u043B\u043E\u0432\u043D\u043E. \u041D\u0438\u043A\u0430\u043A\u043E\u0439 \u043C\u0430\u0433\u0438\u0438 \u0437\u0430 \u043A\u0443\u043B\u0438\u0441\u0430\u043C\u0438.") : /*#__PURE__*/React.createElement(React.Fragment, null, services.filter(s => s.state === 'running').length, " \u0438\u0437 ", services.length, " \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E \u043D\u0430 homelab.local. \u0412\u0441\u0451 \u0436\u0438\u0432\u0451\u0442 \u043D\u0430 \u0442\u0432\u043E\u0451\u043C \u0436\u0435\u043B\u0435\u0437\u0435."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '22px 0 4px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tabs",
    style: {
      border: 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: 'tab' + (tab === 'running' ? ' active' : ''),
    onClick: () => setTab('running')
  }, "\u0437\u0430\u043F\u0443\u0449\u0435\u043D\u043E", /*#__PURE__*/React.createElement("span", {
    className: "tcount"
  }, services.filter(s => s.state === 'running').length)), /*#__PURE__*/React.createElement("button", {
    className: 'tab' + (tab === 'catalog' ? ' active' : ''),
    onClick: () => setTab('catalog')
  }, "\u043A\u0430\u0442\u0430\u043B\u043E\u0433", /*#__PURE__*/React.createElement("span", {
    className: "tcount"
  }, catalog.length)), /*#__PURE__*/React.createElement("button", {
    className: 'tab' + (tab === 'logs' ? ' active' : ''),
    onClick: () => setTab('logs')
  }, "\u0436\u0443\u0440\u043D\u0430\u043B")), tab === 'running' && /*#__PURE__*/React.createElement("span", {
    className: "input-prompt",
    style: {
      marginLeft: 'auto',
      maxWidth: 260
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ps"
  }, "/"), /*#__PURE__*/React.createElement("input", {
    className: "input",
    style: {
      paddingLeft: 32
    },
    placeholder: "\u0444\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0438\u043C\u0435\u043D\u0438",
    value: query,
    onChange: e => setQuery(e.target.value)
  }))), /*#__PURE__*/React.createElement("section", {
    className: "page-block",
    style: {
      paddingTop: 24,
      borderTop: '1px solid var(--border)',
      marginTop: 10
    }
  }, tab === 'logs' ? /*#__PURE__*/React.createElement(LogView, null) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 260px',
      gap: 28,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16
    }
  }, tab === 'catalog' ? catalog.map(c => /*#__PURE__*/React.createElement(CatalogCard, {
    key: c.id,
    item: c,
    onInstall: setInstalling
  })) : shown.map(s => /*#__PURE__*/React.createElement(ServiceCard, {
    key: s.id,
    svc: s,
    onToggle: toggle,
    onOpen: () => pushToast({
      tone: 'note',
      title: s.name,
      body: 'открываю homelab.local:' + s.port
    })
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      position: 'sticky',
      top: 84
    }
  }, /*#__PURE__*/React.createElement(HostPanel, null), /*#__PURE__*/React.createElement("div", {
    className: "contact-card"
  }, /*#__PURE__*/React.createElement("h3", null, "\u041E\u0434\u0438\u043D \u043A\u043B\u0438\u043A"), /*#__PURE__*/React.createElement("p", null, "Dock \u0441\u0430\u043C \u043F\u043E\u0434\u0431\u0435\u0440\u0451\u0442 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u044B\u0439 \u043F\u043E\u0440\u0442, \u043D\u0430\u043F\u0438\u0448\u0435\u0442 compose \u0438 \u043F\u043E\u0434\u043D\u0438\u043C\u0435\u0442 \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440."), /*#__PURE__*/React.createElement("button", {
    className: "btn primary block",
    onClick: () => setTab('catalog')
  }, "[\xA0\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u2192\xA0]")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: 'var(--faint)',
      lineHeight: 1.6
    }
  }, "\u043A\u043E\u043D\u0441\u043E\u043B\u044C: ", /*#__PURE__*/React.createElement("kbd", {
    className: "kbd"
  }, "Ctrl"), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--faint)'
    }
  }, "+"), " ", /*#__PURE__*/React.createElement("kbd", {
    className: "kbd"
  }, "~")))))), /*#__PURE__*/React.createElement(InstallDialog, {
    item: installing,
    onClose: () => setInstalling(null),
    onDone: install
  }), /*#__PURE__*/React.createElement("div", {
    className: "toast-stack"
  }, toasts.map(t => /*#__PURE__*/React.createElement("div", {
    className: 'toast' + (t.tone ? ' ' + t.tone : ''),
    key: t.id
  }, /*#__PURE__*/React.createElement("span", {
    className: "ticon"
  }, t.tone === 'warn' ? '!' : '›'), /*#__PURE__*/React.createElement("div", {
    className: "tbody"
  }, /*#__PURE__*/React.createElement("strong", null, t.title), /*#__PURE__*/React.createElement("span", null, t.body)), /*#__PURE__*/React.createElement("button", {
    className: "tx",
    onClick: () => setToasts(ts => ts.filter(x => x.id !== t.id)),
    "aria-label": "dismiss"
  }, "\u2715")))));
}
Object.assign(window, {
  DockApp,
  ServiceCard,
  CatalogCard,
  HostPanel,
  LogView,
  InstallDialog,
  StateBadge,
  DockBrand
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dock/DockApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/site/SiteApp.jsx
try { (() => {
/* SHFF website — UI kit. Click-through recreation of the live site,
   composed from the DS classes in styles.css. */

const SITE_NAV = [{
  label: '~/manifesto',
  id: 'manifesto'
}, {
  label: '~/wiki',
  id: 'wiki'
}, {
  label: '~/posts',
  id: 'posts'
}, {
  label: '~/about',
  id: 'about'
}];
const SITE_POSTS = [{
  date: '2026-05-29',
  tag: 'сеть',
  title: 'Гик-словарь: NAT',
  excerpt: 'Механизм, который позволяет всей домашней сети выходить в интернет через один публичный IP.'
}, {
  date: '2026-05-29',
  tag: 'медиа',
  title: 'Медиа-стек. Часть 2: Navidrome',
  excerpt: 'Лёгкий музыкальный сервер с Subsonic API. Своя музыка на всех устройствах.'
}, {
  date: '2026-05-26',
  tag: 'медиа',
  title: 'Медиа-стек. Часть 1: qBittorrent',
  excerpt: 'Основа пайплайна: торрент-клиент с веб-интерфейсом и структура папок под медиа.'
}, {
  date: '2026-05-17',
  tag: 'docker',
  title: 'Первый сервис на Docker: PicoShare',
  excerpt: 'Разбираем docker-compose.yml и поднимаем локальный файлообменник.'
}, {
  date: '2026-05-16',
  tag: 'docker',
  title: 'Docker: что это и как поставить',
  excerpt: 'Система контейнеризации, на которой будет крутиться всё остальное.'
}, {
  date: '2026-05-16',
  tag: 'linux',
  title: 'Первое подключение по SSH',
  excerpt: 'Генерируем ed25519-ключи и отключаем вход по паролю.'
}, {
  date: '2026-05-12',
  tag: 'linux',
  title: '9 базовых команд Linux',
  excerpt: 'Минимальный набор, чтобы уверенно ходить по серверу.'
}];
const SITE_CATS = [{
  emoji: '🏠',
  title: 'Homelab & железо',
  desc: 'С чего начать, что купить, сколько это ест электричества.',
  count: '2 гайда'
}, {
  emoji: '🐧',
  title: 'Linux & SSH',
  desc: 'Команды, права, ключи и безопасный вход на сервер.',
  count: '2 гайда'
}, {
  emoji: '🐳',
  title: 'Docker',
  desc: 'Контейнеры, compose и первый рабочий сервис.',
  count: '3 гайда'
}, {
  emoji: '🎬',
  title: 'Медиа-стек',
  desc: 'Торренты, музыка, фильмы — свой пайплайн целиком.',
  count: '2 гайда'
}, {
  emoji: '🔐',
  title: 'Сеть & безопасность',
  desc: 'NAT, порты, reverse proxy и туннели наружу.',
  count: '1 гайд'
}, {
  emoji: '📚',
  title: 'Гик-словарь',
  desc: 'Короткие разборы терминов без снобизма.',
  count: '1 разбор'
}];
const SITE_WHY = [{
  ic: '[!]',
  t: 'Стриминги удаляют контент',
  p: 'Лицензии истекают — и фильм пропадает из библиотеки, которую ты считал своей.',
  c: '→ купленное исчезает без предупреждения'
}, {
  ic: '[!]',
  t: 'Облака закрываются',
  p: 'Сервис может свернуться или забанить аккаунт по алгоритму, без человека и без апелляции.',
  c: '→ данные уходят вместе с аккаунтом'
}, {
  ic: '[!]',
  t: 'Интернет дробится',
  p: 'Доступ зависит от геолокации: то, что открывалось вчера, сегодня требует обходных путей.',
  c: '→ доступ перестаёт быть постоянным'
}, {
  ic: '[!]',
  t: 'Знание пропадает',
  p: 'Книги, статьи и архивы уходят из открытого доступа тихо, без объявления.',
  c: '→ то, что не сохранил, не вернуть'
}];
function SiteTopbar({
  page,
  go
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("a", {
    className: "brand",
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('home');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk"
  }, "SHFF"), /*#__PURE__*/React.createElement("span", {
    className: "hide-sm"
  }, "self_hosted_freedom")), /*#__PURE__*/React.createElement("nav", {
    className: "nav"
  }, SITE_NAV.map(n => /*#__PURE__*/React.createElement("a", {
    key: n.id,
    href: "#",
    onClick: e => {
      e.preventDefault();
      go(n.id);
    },
    style: page === n.id ? {
      color: 'var(--accent)'
    } : undefined
  }, n.label)), /*#__PURE__*/React.createElement("a", {
    className: "tg",
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "~/telegram \u2197"))));
}
function SiteFooter({
  go
}) {
  const col = (title, links) => /*#__PURE__*/React.createElement("div", {
    className: "foot-col",
    key: title
  }, /*#__PURE__*/React.createElement("h4", null, title), links.map(([label, id]) => /*#__PURE__*/React.createElement("a", {
    key: label,
    href: "#",
    onClick: e => {
      e.preventDefault();
      go(id);
    }
  }, label)));
  return /*#__PURE__*/React.createElement("footer", null, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "foot-col foot-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "blk"
  }, "SHFF")), /*#__PURE__*/React.createElement("p", null, "Self-hosted \u0438\u043D\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430, \u0434\u043E\u043C\u0430\u0448\u043D\u0438\u0435 \u0441\u0435\u0440\u0432\u0435\u0440\u044B \u0438 \u0446\u0438\u0444\u0440\u043E\u0432\u0430\u044F \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u044C. \u0421\u0434\u0435\u043B\u0430\u043D\u043E \u0441\u0432\u043E\u0438\u043C \u0434\u043B\u044F \u0441\u0432\u043E\u0438\u0445.")), col('Проект', [['Манифест', 'manifesto'], ['О проекте', 'about'], ['Архив постов', 'posts'], ['Вики', 'wiki']]), col('Навигация', [['Главная', 'home'], ['Библиотека', 'wiki'], ['Статья', 'article']]), /*#__PURE__*/React.createElement("div", {
    className: "foot-col"
  }, /*#__PURE__*/React.createElement("h4", null, "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B"), /*#__PURE__*/React.createElement("a", {
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "Telegram-\u043A\u0430\u043D\u0430\u043B \u2197"))), /*#__PURE__*/React.createElement("div", {
    className: "foot-bottom"
  }, /*#__PURE__*/React.createElement("span", {
    className: "foot-sig"
  }, "Freedom can only live at home."), /*#__PURE__*/React.createElement("span", {
    className: "foot-meta"
  }, "\u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430 \u0442\u043E\u043B\u044C\u043A\u043E self-hosted (Umami), \u0431\u0435\u0437 \u0442\u0440\u0435\u043A\u0438\u043D\u0433\u0430 \u0438 cookies \xB7 [2026]"))));
}
function HeroTerminal() {
  const script = [{
    p: '$ ',
    t: 'whoami'
  }, {
    o: 'self-hosted freedom'
  }, {
    p: '$ ',
    t: 'cat ./mission.txt'
  }, {
    o: 'вернуть данные, сервисы и железо их владельцу'
  }, {
    p: '$ ',
    t: 'docker ps --format "{{.Names}}"'
  }, {
    d: 'navidrome  qbittorrent  picoshare  vaultwarden'
  }, {
    p: '$ ',
    t: 'uptime'
  }, {
    d: 'up 41 days, 6:12 · load 0.14'
  }];
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (n >= script.length) return;
    const id = setTimeout(() => setN(n + 1), n === 0 ? 400 : 620);
    return () => clearTimeout(id);
  }, [n]);
  return /*#__PURE__*/React.createElement("div", {
    className: "term"
  }, /*#__PURE__*/React.createElement("div", {
    className: "term-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot r"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "term-title"
  }, "mikhail@homelab: ~")), /*#__PURE__*/React.createElement("div", {
    className: "term-body"
  }, script.slice(0, n).map((l, i) => /*#__PURE__*/React.createElement("div", {
    className: "line",
    key: i
  }, l.p && /*#__PURE__*/React.createElement("span", {
    className: "prompt"
  }, l.p), l.t && /*#__PURE__*/React.createElement("span", {
    className: "out"
  }, l.t), l.o && /*#__PURE__*/React.createElement("span", {
    className: "out"
  }, l.o), l.d && /*#__PURE__*/React.createElement("span", {
    className: "out dim"
  }, l.d))), /*#__PURE__*/React.createElement("div", {
    className: "line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "prompt"
  }, "$ "), /*#__PURE__*/React.createElement("span", {
    className: "cursor"
  }))));
}
function HomeScreen({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HeroTerminal, null), /*#__PURE__*/React.createElement("div", {
    className: "hero-cta"
  }, /*#__PURE__*/React.createElement("a", {
    className: "btn primary",
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "[\xA0\u041E\u0442\u043A\u0440\u044B\u0442\u044C Telegram-\u043A\u0430\u043D\u0430\u043B \u2197\xA0]"), /*#__PURE__*/React.createElement("a", {
    className: "btn ghost",
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('wiki');
    }
  }, "[\xA0\u0427\u0438\u0442\u0430\u0442\u044C \u0432\u0438\u043A\u0438 \u2192\xA0]"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      placeItems: 'center',
      minHeight: 340
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      height: 240,
      margin: '0 auto',
      borderRadius: '50%',
      border: '1px solid var(--border-lit)',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--faint)',
      fontSize: 12.5,
      background: 'radial-gradient(circle at 30% 25%, rgba(var(--accent-rgb),0.07), transparent 65%)'
    }
  }, "[ interactive globe ]"), /*#__PURE__*/React.createElement("div", {
    className: "globe-hint",
    style: {
      position: 'static',
      marginTop: 18
    }
  }, "// \u0432 \u043F\u0440\u043E\u0434\u0435 \u0437\u0434\u0435\u0441\u044C canvas-\u0433\u043B\u043E\u0431\u0443\u0441 \u0441 \u0443\u0437\u043B\u0430\u043C\u0438 homelab")))))), /*#__PURE__*/React.createElement("section", {
    className: "block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-kicker"
  }, "$ cat ./why.md"), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, "\u041F\u043E\u0447\u0435\u043C\u0443 \u044D\u0442\u043E \u0432\u0430\u0436\u043D\u043E"), /*#__PURE__*/React.createElement("span", {
    className: "sec-note"
  }, "\u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C \u043D\u0430\u0434 \u0434\u0430\u043D\u043D\u044B\u043C\u0438 \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043B \u0431\u044B\u0442\u044C \u0445\u043E\u0431\u0431\u0438")), /*#__PURE__*/React.createElement("div", {
    className: "why-grid"
  }, SITE_WHY.map(w => /*#__PURE__*/React.createElement("div", {
    className: "why-card",
    key: w.t
  }, /*#__PURE__*/React.createElement("div", {
    className: "ic"
  }, w.ic), /*#__PURE__*/React.createElement("h3", null, w.t), /*#__PURE__*/React.createElement("p", null, w.p), /*#__PURE__*/React.createElement("div", {
    className: "conseq"
  }, w.c)))), /*#__PURE__*/React.createElement("div", {
    className: "why-close"
  }, "\u041F\u043E\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0435 \u043B\u0435\u0436\u0430\u0442 \u0443 \u043A\u043E\u0433\u043E-\u0442\u043E \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u2014 \u043E\u043D\u0438 \u043D\u0435 \u0442\u0432\u043E\u0438.", ' ', /*#__PURE__*/React.createElement("span", {
    className: "accent"
  }, "\u0422\u044B \u043F\u0440\u043E\u0441\u0442\u043E \u0430\u0440\u0435\u043D\u0434\u0430\u0442\u043E\u0440 \u0441\u0432\u043E\u0435\u0439 \u0436\u0435 \u0436\u0438\u0437\u043D\u0438.")))), /*#__PURE__*/React.createElement("section", {
    className: "block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-kicker"
  }, "$ tree ./wiki"), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, "\u0411\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430"), /*#__PURE__*/React.createElement("span", {
    className: "sec-note"
  }, "11 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u0432 6 \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u0445")), /*#__PURE__*/React.createElement("div", {
    className: "map-grid"
  }, SITE_CATS.map(c => /*#__PURE__*/React.createElement("a", {
    className: "map-card",
    href: "#",
    key: c.title,
    onClick: e => {
      e.preventDefault();
      go('wiki');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "emoji"
  }, c.emoji), /*#__PURE__*/React.createElement("h3", null, c.title), /*#__PURE__*/React.createElement("p", null, c.desc), /*#__PURE__*/React.createElement("span", {
    className: "count"
  }, c.count, /*#__PURE__*/React.createElement("span", {
    className: "arr"
  }, "\u2192"))))))), /*#__PURE__*/React.createElement("section", {
    className: "block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "sec-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sec-kicker"
  }, "$ tail ./posts"), /*#__PURE__*/React.createElement("h2", {
    className: "sec-title"
  }, "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435"), /*#__PURE__*/React.createElement("span", {
    className: "sec-note"
  }, "\u0434\u0443\u0431\u043B\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u0438\u0437 Telegram")), /*#__PURE__*/React.createElement("div", {
    className: "feed"
  }, SITE_POSTS.slice(0, 5).map(p => /*#__PURE__*/React.createElement("a", {
    className: "feed-item",
    href: "#",
    key: p.title,
    onClick: e => {
      e.preventDefault();
      go('article');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "feed-date"
  }, p.date), /*#__PURE__*/React.createElement("div", {
    className: "feed-main"
  }, /*#__PURE__*/React.createElement("h3", null, p.title), /*#__PURE__*/React.createElement("p", null, p.excerpt)), /*#__PURE__*/React.createElement("span", {
    className: "feed-tag"
  }, p.tag)))), /*#__PURE__*/React.createElement("div", {
    className: "feed-more"
  }, /*#__PURE__*/React.createElement("a", {
    className: "btn ghost",
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('posts');
    }
  }, "[\xA0\u0412\u0441\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u2192\xA0]")))));
}
function Crumbs({
  go,
  current
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "crumbs"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('home');
    }
  }, "~"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "cur"
  }, current));
}
function PostsScreen({
  go
}) {
  const [tag, setTag] = React.useState('all');
  const tags = ['all', 'linux', 'docker', 'медиа', 'сеть'];
  const shown = SITE_POSTS.filter(p => tag === 'all' || p.tag === tag);
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement(Crumbs, {
    go: go,
    current: "posts"
  }), /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, "$ tail -n +1 ./posts/*"), /*#__PURE__*/React.createElement("h1", null, "\u0412\u0441\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u041F\u043E\u043B\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u043F\u043E\u0441\u0442\u043E\u0432 \u043A\u0430\u043D\u0430\u043B\u0430. \u0424\u0438\u043B\u044C\u0442\u0440\u0443\u0439 \u043F\u043E \u0442\u0435\u0433\u0443, \u0447\u0438\u0442\u0430\u0439 \u0432 \u0443\u0434\u043E\u0431\u043D\u043E\u043C \u0444\u043E\u0440\u043C\u0430\u0442\u0435.")), /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flabel"
  }, "// \u0444\u0438\u043B\u044C\u0442\u0440:"), tags.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: 'chip' + (tag === t ? ' active' : ''),
    onClick: () => setTag(t)
  }, t === 'all' ? 'все' : t))), /*#__PURE__*/React.createElement("section", {
    className: "page-block",
    style: {
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "feed-count"
  }, "// ", shown.length, " \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u043E\u0432", tag !== 'all' ? ' · тег: ' + tag : ''), /*#__PURE__*/React.createElement("div", {
    className: "feed"
  }, shown.map(p => /*#__PURE__*/React.createElement("a", {
    className: "feed-item",
    href: "#",
    key: p.title,
    onClick: e => {
      e.preventDefault();
      go('article');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "feed-date"
  }, p.date), /*#__PURE__*/React.createElement("div", {
    className: "feed-main"
  }, /*#__PURE__*/React.createElement("h3", null, p.title), /*#__PURE__*/React.createElement("p", null, p.excerpt)), /*#__PURE__*/React.createElement("span", {
    className: "feed-tag"
  }, p.tag))))), /*#__PURE__*/React.createElement("section", {
    className: "page-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-txt"
  }, /*#__PURE__*/React.createElement("strong", null, "\u041D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0439 \u043D\u043E\u0432\u044B\u0435 \u043F\u043E\u0441\u0442\u044B"), /*#__PURE__*/React.createElement("span", null, "\u0412\u0441\u0451 \u0432\u044B\u0445\u043E\u0434\u0438\u0442 \u043F\u0435\u0440\u0432\u044B\u043C \u0434\u0435\u043B\u043E\u043C \u0432 Telegram.")), /*#__PURE__*/React.createElement("a", {
    className: "btn primary",
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "[\xA0\u041E\u0442\u043A\u0440\u044B\u0442\u044C Telegram \u2197\xA0]")))));
}
function WikiScreen({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement(Crumbs, {
    go: go,
    current: "wiki"
  }), /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, "$ tree ./wiki"), /*#__PURE__*/React.createElement("h1", null, "\u0411\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u041F\u043E\u0441\u0442\u044B \u043A\u0430\u043D\u0430\u043B\u0430, \u0440\u0430\u0437\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0435 \u043F\u043E \u0442\u0435\u043C\u0430\u043C. \u0427\u0438\u0442\u0430\u0439 \u043F\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443 \u043A\u0430\u043A \u043A\u0443\u0440\u0441 \u0438\u043B\u0438 \u043F\u0440\u044B\u0433\u0430\u0439 \u0432 \u043D\u0443\u0436\u043D\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B. \u0412\u0441\u0451, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0434\u043D\u044F\u0442\u044C \u0441\u0432\u043E\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 ", /*#__PURE__*/React.createElement("span", {
    className: "accent"
  }, "\u0441 \u043D\u0443\u043B\u044F"), ".")), /*#__PURE__*/React.createElement("section", {
    className: "page-block",
    style: {
      paddingTop: 8
    }
  }, SITE_CATS.slice(0, 3).map((c, ci) => /*#__PURE__*/React.createElement("div", {
    className: "wiki-cat",
    key: c.title
  }, /*#__PURE__*/React.createElement("div", {
    className: "wiki-cat-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "emoji"
  }, c.emoji), /*#__PURE__*/React.createElement("h2", null, c.title), /*#__PURE__*/React.createElement("span", {
    className: "n"
  }, c.count)), /*#__PURE__*/React.createElement("div", {
    className: "guide-list"
  }, SITE_POSTS.slice(ci * 2, ci * 2 + 2).map((p, i) => /*#__PURE__*/React.createElement("a", {
    className: "guide-row",
    href: "#",
    key: p.title,
    onClick: e => {
      e.preventDefault();
      go('article');
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "gnum"
  }, '0' + (i + 1)), /*#__PURE__*/React.createElement("div", {
    className: "gmain"
  }, /*#__PURE__*/React.createElement("h3", null, p.title), /*#__PURE__*/React.createElement("p", null, p.excerpt)), /*#__PURE__*/React.createElement("span", {
    className: "garr"
  }, "\u2192"))))))), /*#__PURE__*/React.createElement("section", {
    className: "page-block"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cta-strip"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ct-txt"
  }, /*#__PURE__*/React.createElement("strong", null, "\u0425\u043E\u0447\u0435\u0448\u044C \u0432\u0441\u0451 \u043F\u043E\u0434\u0440\u044F\u0434?"), /*#__PURE__*/React.createElement("span", null, "\u041F\u043E\u043B\u043D\u044B\u0439 \u0430\u0440\u0445\u0438\u0432 \u0432 \u0445\u0440\u043E\u043D\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435.")), /*#__PURE__*/React.createElement("a", {
    className: "btn ghost",
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('posts');
    }
  }, "[\xA0\u0412\u0441\u0435 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B \u2192\xA0]")))));
}
function ArticleScreen({
  go
}) {
  const [copied, setCopied] = React.useState(false);
  const [progress, setProgress] = React.useState(18);
  React.useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      setProgress(Math.min(100, h.scrollTop / (h.scrollHeight - h.clientHeight || 1) * 100));
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "progress",
    style: {
      width: progress + '%'
    }
  }), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    className: "article-shell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "article-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "crumbs"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('home');
    }
  }, "~"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      go('wiki');
    }
  }, "wiki"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("span", {
    className: "cur"
  }, "docker")), /*#__PURE__*/React.createElement("div", {
    className: "art-head"
  }, /*#__PURE__*/React.createElement("h1", null, "\u041F\u0435\u0440\u0432\u044B\u0439 \u0441\u0435\u0440\u0432\u0438\u0441 \u043D\u0430 Docker: PicoShare"), /*#__PURE__*/React.createElement("div", {
    className: "art-meta"
  }, /*#__PURE__*/React.createElement("span", null, "2026-05-17"), /*#__PURE__*/React.createElement("span", null, "\xB7"), /*#__PURE__*/React.createElement("span", null, "8 \u043C\u0438\u043D"), /*#__PURE__*/React.createElement("span", {
    className: "tags"
  }, /*#__PURE__*/React.createElement("span", {
    className: "tag"
  }, "docker"), /*#__PURE__*/React.createElement("span", {
    className: "tag"
  }, "compose"))), /*#__PURE__*/React.createElement("p", {
    className: "art-lead"
  }, "\u0420\u0430\u0437\u0431\u0438\u0440\u0430\u0435\u043C \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 docker-compose.yml \u0438 \u043F\u043E\u0434\u043D\u0438\u043C\u0430\u0435\u043C \u043F\u0440\u043E\u0441\u0442\u0435\u0439\u0448\u0438\u0439 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u0444\u0430\u0439\u043B\u043E\u043E\u0431\u043C\u0435\u043D\u043D\u0438\u043A. \u041E\u0434\u0438\u043D \u0444\u0430\u0439\u043B, \u043E\u0434\u043D\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u0430, \u043F\u043E\u043B\u043D\u043E\u0441\u0442\u044C\u044E \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u043C\u043E.")), /*#__PURE__*/React.createElement("div", {
    className: "prose"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "s1"
  }, "\u0417\u0430\u0447\u0435\u043C \u0438\u043C\u0435\u043D\u043D\u043E PicoShare"), /*#__PURE__*/React.createElement("p", null, "\u041D\u0430\u043C \u043D\u0443\u0436\u0435\u043D \u0441\u0435\u0440\u0432\u0438\u0441, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u0434\u0435\u043B\u0430\u0435\u0442 \u043E\u0434\u043D\u0443 \u043F\u043E\u043D\u044F\u0442\u043D\u0443\u044E \u0432\u0435\u0449\u044C \u0438 \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0431\u0430\u0437\u044B \u0434\u0430\u043D\u043D\u044B\u0445, \u043E\u0447\u0435\u0440\u0435\u0434\u0435\u0439 \u0438 \u0434\u0435\u0441\u044F\u0442\u0438 \u043F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0445 \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F. PicoShare \u2014 \u044D\u0442\u043E \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u0430\u0439\u043B\u0430 \u0438 \u0441\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043D\u0435\u0433\u043E. \u0418\u0434\u0435\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0435\u0440\u0432\u044B\u0439 \u043A\u043E\u043D\u0442\u0435\u0439\u043D\u0435\u0440: \u0435\u0441\u043B\u0438 \u043E\u043D \u043F\u043E\u0434\u043D\u044F\u043B\u0441\u044F, \u0437\u043D\u0430\u0447\u0438\u0442 Docker \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D \u0432\u0435\u0440\u043D\u043E."), /*#__PURE__*/React.createElement("p", null, "\u0412\u0441\u0451, \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u2014 \u043E\u0434\u0438\u043D \u0444\u0430\u0439\u043B ", /*#__PURE__*/React.createElement("code", null, "docker-compose.yml"), " \u0438 \u043A\u043E\u043C\u0430\u043D\u0434\u0430 ", /*#__PURE__*/React.createElement("code", null, "docker compose up -d"), "."), /*#__PURE__*/React.createElement("h2", {
    id: "s2"
  }, "\u041F\u0438\u0448\u0435\u043C compose-\u0444\u0430\u0439\u043B"), /*#__PURE__*/React.createElement("div", {
    className: "codeblock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cb-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lang"
  }, "docker-compose.yml"), /*#__PURE__*/React.createElement("button", {
    className: 'copy' + (copied ? ' ok' : ''),
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  }, copied ? 'copied' : 'copy')), /*#__PURE__*/React.createElement("pre", null, /*#__PURE__*/React.createElement("span", {
    className: "tok-cmt"
  }, "# \u043C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0441\u0435\u0440\u0432\u0438\u0441"), '\n', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "services:"), '\n', '  ', /*#__PURE__*/React.createElement("span", {
    className: "tok-fn"
  }, "picoshare:"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "image:"), " ", /*#__PURE__*/React.createElement("span", {
    className: "tok-str"
  }, "mtlynch/picoshare:latest"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "restart:"), " ", /*#__PURE__*/React.createElement("span", {
    className: "tok-str"
  }, "unless-stopped"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "ports:"), '\n', '      ', "- ", /*#__PURE__*/React.createElement("span", {
    className: "tok-str"
  }, "\"3001:4001\""), '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "volumes:"), '\n', '      ', "- ", /*#__PURE__*/React.createElement("span", {
    className: "tok-str"
  }, "./data:/data"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "environment:"), '\n', '      ', /*#__PURE__*/React.createElement("span", {
    className: "tok-key"
  }, "PS_SHARED_SECRET:"), " ", /*#__PURE__*/React.createElement("span", {
    className: "tok-var"
  }, "$", '{', "PS_SECRET", '}'))), /*#__PURE__*/React.createElement("div", {
    className: "callout tip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct"
  }, "\u0421\u041E\u0412\u0415\u0422"), /*#__PURE__*/React.createElement("p", null, "\u0421\u0435\u043A\u0440\u0435\u0442 \u0434\u0435\u0440\u0436\u0438 \u0432 \u0444\u0430\u0439\u043B\u0435 ", /*#__PURE__*/React.createElement("code", null, ".env"), " \u0440\u044F\u0434\u043E\u043C \u0441 compose-\u0444\u0430\u0439\u043B\u043E\u043C \u0438 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043A\u043E\u043C\u043C\u0438\u0442\u044C \u0435\u0433\u043E \u0432 git.")), /*#__PURE__*/React.createElement("h2", {
    id: "s3"
  }, "\u041F\u043E\u0434\u043D\u0438\u043C\u0430\u0435\u043C \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C"), /*#__PURE__*/React.createElement("ul", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "docker compose up -d"), " \u2014 \u043F\u043E\u0434\u043D\u044F\u0442\u044C \u0432 \u0444\u043E\u043D\u0435"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "docker compose ps"), " \u2014 \u0443\u0431\u0435\u0434\u0438\u0442\u044C\u0441\u044F, \u0447\u0442\u043E \u0441\u0442\u0430\u0442\u0443\u0441 ", /*#__PURE__*/React.createElement("code", null, "running")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "docker compose logs -f"), " \u2014 \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043B\u043E\u0433\u0438 \u0436\u0438\u0432\u044C\u0451\u043C")), /*#__PURE__*/React.createElement("div", {
    className: "callout warn"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ct"
  }, "\u0412\u041D\u0418\u041C\u0410\u041D\u0418\u0415"), /*#__PURE__*/React.createElement("p", null, "\u041F\u043E\u0440\u0442 3001 \u043E\u0442\u043A\u0440\u044B\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043D\u0443\u0442\u0440\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E\u0439 \u0441\u0435\u0442\u0438. \u041D\u0435 \u043F\u0440\u043E\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0439 \u0435\u0433\u043E \u043D\u0430\u0440\u0443\u0436\u0443 \u0431\u0435\u0437 reverse proxy \u0438 TLS."))), /*#__PURE__*/React.createElement("div", {
    className: "art-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "related"
  }, /*#__PURE__*/React.createElement("h3", null, "\u0427\u0438\u0442\u0430\u0442\u044C \u0434\u0430\u043B\u044C\u0448\u0435"), /*#__PURE__*/React.createElement("div", {
    className: "rel-grid"
  }, [['docker', 'Docker: что это и как поставить'], ['docker', '9 базовых команд Docker'], ['linux', 'Первое подключение по SSH']].map(([c, t]) => /*#__PURE__*/React.createElement("a", {
    className: "rel-card",
    href: "#",
    key: t,
    onClick: e => {
      e.preventDefault();
      window.scrollTo(0, 0);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "rc-cat"
  }, "// ", c), /*#__PURE__*/React.createElement("h4", null, t))))), /*#__PURE__*/React.createElement("div", {
    className: "discuss"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt"
  }, /*#__PURE__*/React.createElement("strong", null, "\u0412\u043E\u043F\u0440\u043E\u0441\u044B \u043F\u043E \u0433\u0430\u0439\u0434\u0443?"), /*#__PURE__*/React.createElement("span", null, "\u041E\u0431\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u0435 \u0438\u0434\u0451\u0442 \u0432 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u044F\u0445 \u043F\u043E\u0434 \u043F\u043E\u0441\u0442\u043E\u043C.")), /*#__PURE__*/React.createElement("a", {
    className: "btn primary",
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "[\xA0\u041E\u0431\u0441\u0443\u0434\u0438\u0442\u044C \u0432 Telegram \u2197\xA0]")), /*#__PURE__*/React.createElement("div", {
    className: "art-sig"
  }, "// Freedom can only live at home."))), /*#__PURE__*/React.createElement("div", {
    className: "toc-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toc"
  }, /*#__PURE__*/React.createElement("div", {
    className: "toc-h"
  }, "\u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement("a", {
    className: "active",
    href: "#s1"
  }, "\u0417\u0430\u0447\u0435\u043C \u0438\u043C\u0435\u043D\u043D\u043E PicoShare"), /*#__PURE__*/React.createElement("a", {
    href: "#s2"
  }, "\u041F\u0438\u0448\u0435\u043C compose-\u0444\u0430\u0439\u043B"), /*#__PURE__*/React.createElement("a", {
    href: "#s3"
  }, "\u041F\u043E\u0434\u043D\u0438\u043C\u0430\u0435\u043C \u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C"))))));
}
function ManifestoScreen({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement(Crumbs, {
    go: go,
    current: "manifesto"
  }), /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, "$ cat ./manifesto.txt"), /*#__PURE__*/React.createElement("h1", null, "\u041C\u0430\u043D\u0438\u0444\u0435\u0441\u0442"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "\u041F\u043E\u0447\u0435\u043C\u0443 \u043C\u044B \u0434\u0435\u0440\u0436\u0438\u043C \u0441\u0432\u043E\u0438 \u0434\u0430\u043D\u043D\u044B\u0435, \u0441\u0435\u0440\u0432\u0438\u0441\u044B \u0438 \u0436\u0435\u043B\u0435\u0437\u043E \u043F\u0440\u0438 \u0441\u0435\u0431\u0435.")), /*#__PURE__*/React.createElement("section", {
    className: "page-block",
    style: {
      paddingTop: 34
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "manifesto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "m-term"
  }, "mikhail@homelab:~$ ./read manifesto.txt", /*#__PURE__*/React.createElement("span", {
    className: "cursor"
  })), /*#__PURE__*/React.createElement("p", null, "\u041C\u044B \u0432\u044B\u0440\u043E\u0441\u043B\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0447\u0443\u0436\u0438\u0445 \u0441\u0435\u0440\u0432\u0438\u0441\u043E\u0432. \u041D\u0430\u0448\u0438 \u0444\u043E\u0442\u043E\u0433\u0440\u0430\u0444\u0438\u0438, \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u043A\u0438, \u043C\u0443\u0437\u044B\u043A\u0430 \u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043B\u0435\u0436\u0430\u0442 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430\u0445, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0430\u043C \u043D\u0435 \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0442 \u0438 \u0443\u043F\u0440\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043F\u043E \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u044B \u043D\u0435 \u043F\u0438\u0441\u0430\u043B\u0438."), /*#__PURE__*/React.createElement("p", {
    className: "big"
  }, "\u041F\u043E\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0435 \u043B\u0435\u0436\u0430\u0442 \u0443 \u043A\u043E\u0433\u043E-\u0442\u043E \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u2014 \u043E\u043D\u0438 \u043D\u0435 \u0442\u0432\u043E\u0438. \u0422\u044B \u043F\u0440\u043E\u0441\u0442\u043E ", /*#__PURE__*/React.createElement("span", {
    className: "accent"
  }, "\u0430\u0440\u0435\u043D\u0434\u0430\u0442\u043E\u0440 \u0441\u0432\u043E\u0435\u0439 \u0436\u0435 \u0436\u0438\u0437\u043D\u0438"), "."), /*#__PURE__*/React.createElement("h2", null, "// \u043F\u0440\u0438\u043D\u0446\u0438\u043F\u044B"), /*#__PURE__*/React.createElement("div", {
    className: "principle"
  }, /*#__PURE__*/React.createElement("strong", null, "\u0414\u0430\u043D\u043D\u044B\u0435 \u2014 \u0434\u043E\u043C\u0430"), /*#__PURE__*/React.createElement("p", null, "\u0422\u0432\u043E\u0438 \u0444\u0430\u0439\u043B\u044B \u0436\u0438\u0432\u0443\u0442 \u043D\u0430 \u0442\u0432\u043E\u0451\u043C \u0436\u0435\u043B\u0435\u0437\u0435. \u041D\u0438\u043A\u0442\u043E \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u043E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043A \u0442\u043E\u043C\u0443, \u0447\u0442\u043E \u0441\u0442\u043E\u0438\u0442 \u0443 \u0442\u0435\u0431\u044F \u043D\u0430 \u043F\u043E\u043B\u043A\u0435.")), /*#__PURE__*/React.createElement("div", {
    className: "principle"
  }, /*#__PURE__*/React.createElement("strong", null, "\u0421\u0435\u0440\u0432\u0438\u0441\u044B \u2014 \u043F\u043E\u0434 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u0435\u043C"), /*#__PURE__*/React.createElement("p", null, "\u0422\u044B \u0440\u0435\u0448\u0430\u0435\u0448\u044C, \u0447\u0442\u043E \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u0438 \u043A\u043E\u0433\u0434\u0430 \u043E\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0442\u044C. \u0411\u0435\u0437 \u043D\u0430\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445 \u0442\u0430\u0440\u0438\u0444\u043E\u0432 \u0438 \u0442\u0451\u043C\u043D\u044B\u0445 \u043F\u0430\u0442\u0442\u0435\u0440\u043D\u043E\u0432.")), /*#__PURE__*/React.createElement("div", {
    className: "principle"
  }, /*#__PURE__*/React.createElement("strong", null, "\u0417\u043D\u0430\u043D\u0438\u0435 \u2014 \u043E\u0442\u043A\u0440\u044B\u0442\u043E"), /*#__PURE__*/React.createElement("p", null, "\u041E\u0434\u0438\u043D compose-\u0444\u0430\u0439\u043B, \u043E\u0434\u043D\u0430 \u043A\u043E\u043C\u0430\u043D\u0434\u0430, \u0432\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u043C\u043E \u043A\u0435\u043C \u0443\u0433\u043E\u0434\u043D\u043E.")), /*#__PURE__*/React.createElement("p", {
    className: "big"
  }, "\u0422\u0432\u043E\u0438 \u0434\u0430\u043D\u043D\u044B\u0435. \u0422\u0432\u043E\u0438 \u0441\u0435\u0440\u0432\u0438\u0441\u044B. ", /*#__PURE__*/React.createElement("span", {
    className: "accent"
  }, "\u0422\u0432\u043E\u0451 \u0436\u0435\u043B\u0435\u0437\u043E.")), /*#__PURE__*/React.createElement("div", {
    className: "m-sig"
  }, "// Freedom can only live at home.")))));
}
function AboutScreen({
  go
}) {
  return /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement("div", {
    className: "page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "page-head"
  }, /*#__PURE__*/React.createElement(Crumbs, {
    go: go,
    current: "about"
  }), /*#__PURE__*/React.createElement("span", {
    className: "kick"
  }, "$ cat ./about.md"), /*#__PURE__*/React.createElement("h1", null, "\u041E \u043F\u0440\u043E\u0435\u043A\u0442\u0435"), /*#__PURE__*/React.createElement("p", {
    className: "lede"
  }, "Telegram-\u043A\u0430\u043D\u0430\u043B \u0438 \u0436\u0438\u0432\u0430\u044F \u0431\u0438\u0431\u043B\u0438\u043E\u0442\u0435\u043A\u0430 \u043E \u0434\u043E\u043C\u0430\u0448\u043D\u0438\u0445 \u0441\u0435\u0440\u0432\u0435\u0440\u0430\u0445 \u0438 \u0446\u0438\u0444\u0440\u043E\u0432\u043E\u0439 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E\u0441\u0442\u0438.")), /*#__PURE__*/React.createElement("section", {
    className: "page-block",
    style: {
      paddingTop: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "about-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "about-prose"
  }, /*#__PURE__*/React.createElement("h2", null, "\u0427\u0442\u043E \u044D\u0442\u043E"), /*#__PURE__*/React.createElement("p", null, "SHFF \u2014 \u043D\u0435\u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u0441\u0442\u0432\u043E \u0432\u043E\u043A\u0440\u0443\u0433 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 \u0438\u0434\u0435\u0438: ", /*#__PURE__*/React.createElement("strong", null, "\u0438\u043D\u0444\u0440\u0430\u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0443 \u043C\u043E\u0436\u043D\u043E \u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043F\u0440\u0438 \u0441\u0435\u0431\u0435"), ". \u0417\u0434\u0435\u0441\u044C \u043F\u043E \u0448\u0430\u0433\u0430\u043C \u0440\u0430\u0437\u0431\u0438\u0440\u0430\u0435\u0442\u0441\u044F, \u043A\u0430\u043A \u043F\u043E\u0434\u043D\u044F\u0442\u044C \u0441\u0432\u043E\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 \u0434\u043E\u043C\u0430."), /*#__PURE__*/React.createElement("h2", null, "\u0410\u0432\u0442\u043E\u0440"), /*#__PURE__*/React.createElement("p", null, "\u041F\u0440\u043E\u0435\u043A\u0442 \u0432\u0435\u0434\u0451\u0442 ", /*#__PURE__*/React.createElement("strong", null, "\u041C\u0438\u0445\u0430\u0438\u043B"), " \u2014 \u0434\u0435\u0440\u0436\u0438\u0442 \u0434\u043E\u043C\u0430 \u043C\u0438\u043D\u0438-\u041F\u041A \u043D\u0430 Intel N100 \u0441 \u0434\u0435\u0441\u044F\u0442\u043A\u043E\u043C \u0441\u0435\u0440\u0432\u0438\u0441\u043E\u0432 \u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0432\u0441\u0451, \u0447\u0442\u043E \u043D\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u0442."), /*#__PURE__*/React.createElement("h2", null, "\u041F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u0441\u0442\u044C"), /*#__PURE__*/React.createElement("p", null, "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430 \u0442\u043E\u043B\u044C\u043A\u043E self-hosted (Umami), ", /*#__PURE__*/React.createElement("strong", null, "\u0431\u0435\u0437 \u0442\u0440\u0435\u043A\u0438\u043D\u0433\u0430, \u0431\u0435\u0437 cookies"), " \u0438 \u0431\u0435\u0437 \u0441\u0442\u043E\u0440\u043E\u043D\u043D\u0438\u0445 \u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432.")), /*#__PURE__*/React.createElement("div", {
    className: "about-side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spec-card"
  }, /*#__PURE__*/React.createElement("h3", null, "// spec"), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0445\u043E\u0441\u0442\u0438\u043D\u0433"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "self-hosted")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0441\u0435\u0440\u0432\u0435\u0440"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "Intel N100")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u041E\u0421"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "Debian 12")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0441\u0435\u0440\u0432\u0438\u0441\u044B"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "14 up")), /*#__PURE__*/React.createElement("div", {
    className: "spec-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "\u0442\u0440\u0435\u043A\u0438\u043D\u0433"), /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "\u043D\u0435\u0442"))), /*#__PURE__*/React.createElement("div", {
    className: "contact-card"
  }, /*#__PURE__*/React.createElement("h3", null, "\u0421\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F"), /*#__PURE__*/React.createElement("p", null, "\u0412\u043E\u043F\u0440\u043E\u0441\u044B, \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F, \u0438\u0434\u0435\u0438 \u0434\u043B\u044F \u043F\u043E\u0441\u0442\u043E\u0432 \u2014 \u043F\u0438\u0448\u0438 \u043F\u0440\u044F\u043C\u043E \u0432 \u043A\u0430\u043D\u0430\u043B."), /*#__PURE__*/React.createElement("a", {
    className: "btn primary block",
    href: "https://t.me/selfhostedfreedom",
    target: "_blank",
    rel: "noopener"
  }, "[\xA0\u041E\u0442\u043A\u0440\u044B\u0442\u044C Telegram \u2197\xA0]")))))));
}
function SiteApp() {
  const [page, setPage] = React.useState('home');
  const go = p => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  const screens = {
    home: HomeScreen,
    posts: PostsScreen,
    wiki: WikiScreen,
    article: ArticleScreen,
    manifesto: ManifestoScreen,
    about: AboutScreen
  };
  const Screen = screens[page] || HomeScreen;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scanlines"
  }), /*#__PURE__*/React.createElement(SiteTopbar, {
    page: page,
    go: go
  }), /*#__PURE__*/React.createElement(Screen, {
    go: go
  }), /*#__PURE__*/React.createElement(SiteFooter, {
    go: go
  }));
}
Object.assign(window, {
  SiteApp,
  SiteTopbar,
  SiteFooter,
  HeroTerminal,
  HomeScreen,
  PostsScreen,
  WikiScreen,
  ArticleScreen,
  ManifestoScreen,
  AboutScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/site/SiteApp.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.CodeBlock = __ds_scope.CodeBlock;

__ds_ns.CtaStrip = __ds_scope.CtaStrip;

__ds_ns.FeedItem = __ds_scope.FeedItem;

__ds_ns.GuideRow = __ds_scope.GuideRow;

__ds_ns.MapCard = __ds_scope.MapCard;

__ds_ns.PageHead = __ds_scope.PageHead;

__ds_ns.SectionHead = __ds_scope.SectionHead;

__ds_ns.SpecCard = __ds_scope.SpecCard;

__ds_ns.WhyCard = __ds_scope.WhyCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.Panel = __ds_scope.Panel;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.ToastStack = __ds_scope.ToastStack;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Breadcrumbs = __ds_scope.Breadcrumbs;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.MobileMenu = __ds_scope.MobileMenu;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.Topbar = __ds_scope.Topbar;

__ds_ns.Caret = __ds_scope.Caret;

__ds_ns.PtyConsole = __ds_scope.PtyConsole;

__ds_ns.TerminalWindow = __ds_scope.TerminalWindow;

})();
