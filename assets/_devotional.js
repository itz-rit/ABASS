
/* ==========================================================================
   ABASS — DEVOTIONAL UPGRADE SCRIPTS
   1. Hero darshan caption (mobile-first hero value image)
   2. Seva Sankalpam sponsor dropdown
   ========================================================================== */

/* ============ HERO DARSHAN CAPTION ============ */
(function(){
  var slideshow = document.querySelector('.hero-slideshow');
  if(!slideshow) return;

  var cap = slideshow.querySelector('.hero-darshan-cap');
  if(!cap) return;
  var capTitle = cap.querySelector('.cap-title');
  if(!capTitle) return;

  function syncCaption(){
    var active = slideshow.querySelector('.hero-slide.active');
    if(!active) return;
    var en = active.getAttribute('data-title-en') || '';
    var ta = active.getAttribute('data-title-ta') || en;
    capTitle.setAttribute('data-en', en);
    capTitle.setAttribute('data-ta', ta);
    capTitle.innerHTML = (document.body.classList.contains('lang-ta') ? ta : en);
  }

  // re-sync whenever the active slide changes
  var observer = new MutationObserver(function(){ syncCaption(); });
  slideshow.querySelectorAll('.hero-slide').forEach(function(s){
    observer.observe(s, { attributes:true, attributeFilter:['class'] });
  });

  document.querySelectorAll('.lang-btn').forEach(function(b){
    b.addEventListener('click', function(){ setTimeout(syncCaption, 0); });
  });

  syncCaption();
})();


/* ============ SEVA SANKALPAM — UPCOMING EVENTS ONLY ============
   The list below mirrors the "Upcoming Events" on events.html.
   - No donation amounts are shown or collected here; submitting the form
     just shows an on-page thank-you confirmation — nothing is sent
     automatically. A Trustee follows up directly with the devotee to
     confirm the sankalpam and share the official bank / UPI information.
   - `until` (YYYY-MM-DD, inclusive) hides an event automatically once its
     last day has passed. Recurring events have no `until`.
   To add or change an event, edit the SEVAS array (and events.html).
   ================================================================== */
(function(){
  var form = document.querySelector('[data-seva-form]');
  if(!form) return;

  var SEVAS = [
    {
      id:'annadhaanam',
      en:'Monthly Annadhaanam', ta:'மாதாந்திர அன்னதானம்',
      whenEn:'Every 2nd Saturday', whenTa:'ஒவ்வொரு மாத 2வது சனி',
      locationEn:'Pallavaram, Chennai', locationTa:'பல்லாவரம், சென்னை',
      descEn:'Free meal offering for a minimum of 250 persons, held every Second Saturday of the month.',
      descTa:'ஒவ்வொரு மாத இரண்டாவது சனிக்கிழமையும் குறைந்தது 250 பேருக்கு இலவச அன்னதானம்.'
    },
    {
      id:'kumbabhishekam', until:'2026-10-30',
      en:'Pallavaram Bharathi Nagar Pillayar Koil Kumbabhishekam Annadhaanam',
      ta:'பல்லாவரம் பாரதி நகர் பிள்ளையார் கோவில் கும்பாபிஷேகம் அன்னதானம்',
      whenEn:'27–30 Oct 2026', whenTa:'27–30 அக் 2026',
      locationEn:'Pallavaram, Chennai', locationTa:'பல்லாவரம், சென்னை',
      descEn:'Annadhaanam in connection with the Kumbabhishekam at Bharathi Nagar Pillayar Koil, Pallavaram, from 27th to 30th October 2026.',
      descTa:'27 முதல் 30 அக்டோபர் 2026 வரை பல்லாவரம் பாரதி நகர் பிள்ளையார் கோவில் கும்பாபிஷேகத்தின் போது அன்னதானம்.'
    },
    {
      id:'padi', until:'2026-12-12',
      en:'Yearly Padi Pooja', ta:'ஆண்டு படி பூஜை',
      whenEn:'12 Dec 2026', whenTa:'12 டிச 2026',
      locationEn:'Zamin Pallavaram, Chennai', locationTa:'ஜமீன் பல்லாவரம், சென்னை',
      descEn:'Annual 18 Padi Pooja observed on 12th December 2026.',
      descTa:'12 டிசம்பர் 2026 அன்று ஆண்டு 18 படி பூஜை நடைபெறும்.'
    },
    {
      id:'vilakku', until:'2026-12-19',
      en:'Yearly Vilakku Pooja', ta:'ஆண்டு விளக்கு பூஜை',
      whenEn:'19 Dec 2026', whenTa:'19 டிச 2026',
      locationEn:'Zamin Pallavaram, Chennai', locationTa:'ஜமீன் பல்லாவரம், சென்னை',
      descEn:'Annual Thiru Vilakku Pooja observed on 19th December 2026.',
      descTa:'19 டிசம்பர் 2026 அன்று ஆண்டு திருவிளக்கு பூஜை நடைபெறும்.'
    }
  ];

  /* keep only events that have not finished yet */
  function todayStr(){
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  var today = todayStr();
  var UPCOMING = SEVAS.filter(function(s){ return !s.until || s.until >= today; });

  var select     = form.querySelector('[data-seva-select]');
  var detailBox  = form.querySelector('[data-seva-detail]');
  if(!select || !detailBox) return;

  function isTa(){ return document.body.classList.contains('lang-ta'); }
  function pick(item, key){ return isTa() ? (item[key + 'Ta'] || item[key + 'En']) : item[key + 'En']; }
  function displayLocation(item){
    var location = pick(item, 'location');
    if(!location) return '';
    var parts = location.split(',').map(function(part){ return part.trim(); });
    return parts.length > 2 ? parts.slice(-2).join(', ') : location;
  }
  function current(){
    for(var i = 0; i < UPCOMING.length; i++){ if(UPCOMING[i].id === select.value) return UPCOMING[i]; }
    return UPCOMING[0];
  }

  /* ---- dropdown: upcoming events only, bilingual ---- */
  function buildOptions(){
    select.innerHTML = '';
    UPCOMING.forEach(function(s){
      var opt = document.createElement('option');
      opt.value = s.id;
      opt.setAttribute('data-en', s.en);
      opt.setAttribute('data-ta', s.ta);
      opt.textContent = isTa() ? s.ta : s.en;
      select.appendChild(opt);
    });
  }

  /* ---- detail card: event name, date, location, description ---- */
  function renderDetail(){
    var s = current();
    if(!s){ detailBox.innerHTML = ''; return; }

    detailBox.innerHTML =
      '<div class="seva-detail-top">' +
        '<span class="seva-detail-name"></span>' +
        '<div class="seva-detail-meta">' +
          '<span class="seva-detail-amt"></span>' +
          '<span class="seva-detail-location">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 22s7-7.2 7-13a7 7 0 1 0-14 0c0 5.8 7 13 7 13z"/><circle cx="12" cy="9" r="2.3"/></svg>' +
            '<span class="seva-detail-location-text"></span>' +
          '</span>' +
        '</div>' +
      '</div>' +
      '<p class="seva-detail-desc"></p>';

    detailBox.querySelector('.seva-detail-name').textContent = isTa() ? s.ta : s.en;
    detailBox.querySelector('.seva-detail-amt').textContent  = pick(s, 'when');
    var location = displayLocation(s);
    var locationRow = detailBox.querySelector('.seva-detail-location');
    if(location){
      detailBox.querySelector('.seva-detail-location-text').textContent = location;
    }else{
      locationRow.hidden = true;
    }
    detailBox.querySelector('.seva-detail-desc').textContent = pick(s, 'desc');
  }

  /* ---- fetch live events from Supabase ---- */
  if(window.ABASS_API && window.ABASS_API.getEvents){
    window.ABASS_API.getEvents({ upcomingOnly: true }).then(function(res){
      if(res && res.data && res.data.length > 0){
        UPCOMING = res.data.map(function(e){
          return {
            id: e.slug || e.id,
            en: e.title_en,
            ta: e.title_ta || e.title_en,
            whenEn: e.date_display_en || (e.is_recurring ? (e.recurrence_rule || 'Monthly') : (e.start_date + (e.end_date ? ' to ' + e.end_date : ''))),
            whenTa: e.date_display_ta || e.date_display_en || '',
            locationEn: e.location_en || '',
            locationTa: e.location_ta || e.location_en || '',
            descEn: e.description_en || '',
            descTa: e.description_ta || e.description_en || '',
            until: e.end_date || e.start_date || null
          };
        });
        buildOptions();
        renderDetail();
      }
    }).catch(function(err){
      console.warn('Seva Sankalpam Supabase sync error:', err);
    });
  }

  /* ---- show an on-page confirmation instead of sending via WhatsApp ---- */
  var thanksBox = form.querySelector('[data-seva-thanks]');

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var s = current();
    if(!s) return;

    if(thanksBox){
      thanksBox.hidden = false;
      thanksBox.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
    form.reset();
    renderDetail();
  });

  /* hide the confirmation again once the devotee starts a new entry */
  form.addEventListener('input', function(){
    if(thanksBox && !thanksBox.hidden) thanksBox.hidden = true;
  });

  select.addEventListener('change', renderDetail);

  /* rebuild in the newly chosen language */
  document.querySelectorAll('.lang-btn').forEach(function(b){
    b.addEventListener('click', function(){
      var keep = select.value;
      setTimeout(function(){
        buildOptions();
        if(keep) select.value = keep;
        renderDetail();
      }, 0);
    });
  });

  buildOptions();
  renderDetail();
  /* the saved language may already be Tamil on page load */
  if(isTa()){ buildOptions(); renderDetail(); }
})();
