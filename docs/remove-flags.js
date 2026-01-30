/* Remove all icons from language switcher - text only, no flags/avatars */
(function() {
  function removeLangIcons() {
    /* Remove any img: flags (cloudfront), mintcdn language icons (circular dots) */
    document.querySelectorAll('img').forEach(function(el) {
      var src = (el.src || el.getAttribute('src') || '').toLowerCase();
      if (src.indexOf('flag') >= 0 ||
          (src.indexOf('cloudfront') >= 0 && src.indexOf('flags') >= 0) ||
          (src.indexOf('mintcdn') >= 0 && src.indexOf('languages') >= 0)) {
        el.remove();
      }
    });
    /* Remove icons in nav dropdown - img, svg, and icon container (circular dot) */
    document.querySelectorAll('[class*="nav-dropdown-item"] img, [class*="nav-dropdown-item"] svg, [class*="dropdown-item-icon"]').forEach(function(el) {
      el.remove();
    });
    /* Hide icon in localization dropdown items (menuitem) - circular dot before text */
    document.querySelectorAll('[id^="localization-select-item-"]').forEach(function(item) {
      var iconWrapper = item.querySelector('.size-4') || item.querySelector('.shrink-0.rounded-full') || item.firstElementChild;
      if (iconWrapper && iconWrapper.tagName !== 'P') {
        iconWrapper.style.cssText = 'display:none!important;width:0!important;height:0!important;visibility:hidden!important;';
      }
    });
    /* Remove icon in language trigger - circular div (localization-select-trigger) */
    var trigger = document.getElementById('localization-select-trigger');
    if (trigger) {
      var iconWrapper = trigger.querySelector('.size-4') || trigger.querySelector('.shrink-0.rounded-full') || trigger.querySelector('div.absolute.rounded-full') || trigger.querySelector('div:first-child');
      if (iconWrapper) {
        iconWrapper.style.cssText = 'display:none!important;width:0!important;height:0!important;visibility:hidden!important;';
      }
    }
  }
  function run() {
    removeLangIcons();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  setTimeout(run, 200);
  setTimeout(run, 600);
  setTimeout(run, 1500);
  /* Watch for dropdown open - remove icons when DOM changes (throttled) */
  var throttle = null;
  var observer = new MutationObserver(function() {
    if (!throttle) {
      throttle = setTimeout(function() {
        removeLangIcons();
        throttle = null;
      }, 100);
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
})();
