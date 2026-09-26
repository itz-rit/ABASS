/**
 * ABASS Admin Panel JavaScript
 * Supabase Auth, Row Level Security verification, and CRUD operations for:
 * 1. Events (Start/End Date, Recurring, Location, Published status)
 * 2. Gallery (Image upload to Supabase Storage bucket 'gallery', Categories, Bilingual fields)
 * 3. Trustees & Committee (54 members, Groups, Profile fields: Family, Gothram, Star, Rasi)
 */

(function () {
  'use strict';

  // --- STATE ---
  var state = {
    user: null,
    isAdmin: false,
    isRecoveringPassword: false,
    activeTab: 'dashboard',
    events: [],
    gallery: [],
    members: [],
    memberGroupFilter: 'all',
    memberSearchQuery: ''
  };

  function getClient() {
    return window.ABASS_API ? window.ABASS_API.getClient() : null;
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.innerHTML = (type === 'success' ? '✓ ' : '✕ ') + message;
    container.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 300);
    }, 4000);
  }

  // --- AUTHENTICATION & PERMISSIONS ---
  async function checkAuth() {
    var client = getClient();
    if (!client) {
      showConfigScreen('Please configure your Supabase URL and Public Anon Key below.');
      return;
    }

    if (state.isRecoveringPassword || (window.location.hash && window.location.hash.indexOf('type=recovery') !== -1)) {
      state.isRecoveringPassword = true;
      showResetPasswordScreen();
      return;
    }

    try {
      var sessionRes = await client.auth.getSession();
      var session = sessionRes.data ? sessionRes.data.session : null;

      if (!session || !session.user) {
        showAuthScreen();
        return;
      }

      state.user = session.user;

      // Check admin authorization via admin_users table (enforced by RLS)
      var adminRes = await client
        .from('admin_users')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (adminRes.error || !adminRes.data) {
        state.isAdmin = false;
        showAccessDeniedScreen(session.user.email);
        return;
      }

      state.isAdmin = true;
      showDashboardScreen();
    } catch (err) {
      console.error('Auth check error:', err);
      showAuthScreen();
    }
  }

  function showAuthScreen() {
    document.getElementById('authView').style.display = 'flex';
    document.getElementById('accessDeniedView').style.display = 'none';
    document.getElementById('adminShell').style.display = 'none';
    var resetView = document.getElementById('resetPasswordView');
    if (resetView) resetView.style.display = 'none';
  }

  function showAccessDeniedScreen(email) {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('accessDeniedView').style.display = 'flex';
    document.getElementById('adminShell').style.display = 'none';
    var resetView = document.getElementById('resetPasswordView');
    if (resetView) resetView.style.display = 'none';
    document.getElementById('deniedUserEmail').textContent = email || 'Unknown';
  }

  function showDashboardScreen() {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('accessDeniedView').style.display = 'none';
    var resetView = document.getElementById('resetPasswordView');
    if (resetView) resetView.style.display = 'none';
    document.getElementById('adminShell').style.display = 'flex';
    document.getElementById('adminUserEmail').textContent = state.user ? state.user.email : '';
    switchTab('dashboard');
    loadAllData();
  }

  function showResetPasswordScreen() {
    document.getElementById('authView').style.display = 'none';
    document.getElementById('accessDeniedView').style.display = 'none';
    document.getElementById('adminShell').style.display = 'none';
    var resetView = document.getElementById('resetPasswordView');
    if (resetView) resetView.style.display = 'flex';

    var form = document.getElementById('resetPasswordForm');
    if (form) {
      form.style.display = 'flex';
      form.reset();
    }
    var errEl = document.getElementById('resetPasswordError');
    if (errEl) {
      errEl.style.display = 'none';
      errEl.textContent = '';
    }
    var successEl = document.getElementById('resetPasswordSuccess');
    if (successEl) {
      successEl.style.display = 'none';
    }
    var submitBtn = document.getElementById('resetPasswordSubmitBtn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Update Password';
    }
  }

  function showConfigScreen(msg) {
    showAuthScreen();
    var notice = document.getElementById('authConfigNotice');
    if (notice) {
      notice.textContent = msg || '';
      notice.style.display = 'block';
    }
  }

  // --- LOGIN HANDLER ---
  async function handleLogin(e) {
    e.preventDefault();
    var client = getClient();
    if (!client) {
      alert('Supabase client is not configured yet. Please enter your Supabase URL and Anon Key.');
      return;
    }

    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var btn = document.getElementById('loginSubmitBtn');
    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    try {
      var res = await client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) {
        alert('Login failed: ' + res.error.message);
        btn.disabled = false;
        btn.textContent = 'Sign In to Admin Panel';
        return;
      }
      checkAuth();
    } catch (err) {
      alert('Login error: ' + (err.message || err));
      btn.disabled = false;
      btn.textContent = 'Sign In to Admin Panel';
    }
  }

  // --- LOGOUT HANDLER ---
  async function handleLogout() {
    var client = getClient();
    if (client) {
      await client.auth.signOut();
    }
    state.user = null;
    state.isAdmin = false;
    showToast('Signed out successfully.');
    showAuthScreen();
  }

  // --- PASSWORD RECOVERY HANDLERS ---
  async function handleForgotPassword(e) {
    if (e) e.preventDefault();
    var client = getClient();
    if (!client) {
      alert('Supabase client is not configured yet. Please enter your Supabase URL and Anon Key.');
      return;
    }

    var emailInput = document.getElementById('loginEmail');
    var email = (emailInput && emailInput.value.trim()) ? emailInput.value.trim() : 'rithikap099@gmail.com';
    if (emailInput && !emailInput.value.trim()) {
      emailInput.value = email;
    }

    var forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.textContent = 'Sending reset email...';
      forgotLink.style.pointerEvents = 'none';
    }

    try {
      var res = await client.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:3000/admin.html'
      });

      if (res.error) {
        alert('Failed to send reset email: ' + res.error.message);
      } else {
        showToast('Password reset link sent to ' + email, 'success');
        var notice = document.getElementById('authConfigNotice');
        if (notice) {
          notice.textContent = 'Password reset link sent to ' + email + '. Check your inbox to set a new password.';
          notice.style.background = '#e8f7ee';
          notice.style.borderColor = '#86efac';
          notice.style.color = '#166534';
          notice.style.display = 'block';
        }
      }
    } catch (err) {
      alert('Error sending reset email: ' + (err.message || err));
    } finally {
      if (forgotLink) {
        forgotLink.textContent = 'Forgot Password?';
        forgotLink.style.pointerEvents = 'auto';
      }
    }
  }

  async function handleResetPassword(e) {
    if (e) e.preventDefault();
    var client = getClient();
    if (!client) {
      alert('Supabase client is not configured.');
      return;
    }

    var newPassword = document.getElementById('newPassword').value;
    var confirmPassword = document.getElementById('confirmNewPassword').value;
    var errorEl = document.getElementById('resetPasswordError');
    var submitBtn = document.getElementById('resetPasswordSubmitBtn');

    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }

    if (!newPassword || newPassword.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (errorEl) {
        errorEl.textContent = 'Passwords do not match. Please re-enter.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating Password...';
    }

    try {
      var res = await client.auth.updateUser({ password: newPassword });
      if (res.error) {
        if (errorEl) {
          errorEl.textContent = 'Password update failed: ' + res.error.message;
          errorEl.style.display = 'block';
        } else {
          alert('Password update failed: ' + res.error.message);
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Password';
        }
        return;
      }

      state.isRecoveringPassword = false;
      showToast('Password updated successfully!', 'success');

      var form = document.getElementById('resetPasswordForm');
      if (form) form.style.display = 'none';

      var successEl = document.getElementById('resetPasswordSuccess');
      if (successEl) successEl.style.display = 'block';

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Error: ' + (err.message || err);
        errorEl.style.display = 'block';
      } else {
        alert('Error: ' + (err.message || err));
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
    }
  }

  function returnToLogin() {
    state.isRecoveringPassword = false;
    var client = getClient();
    if (client) {
      client.auth.signOut().catch(function () {});
    }
    state.user = null;
    state.isAdmin = false;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    showAuthScreen();
  }

  // --- TAB NAVIGATION ---
  function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.view-section').forEach(function (sec) {
      sec.classList.toggle('active', sec.id === 'view-' + tabName);
    });

    if (tabName === 'events') renderEventsTable();
    if (tabName === 'gallery') renderGalleryGrid();
    if (tabName === 'trustees') renderTrusteesTable();
    if (tabName === 'settings') populateSettingsForm();
  }

  // --- DATA LOADING ---
  async function loadAllData() {
    var client = getClient();
    if (!client) return;

    // Load Events
    try {
      var eRes = await client.from('events').select('*').order('display_order', { ascending: true });
      if (!eRes.error && eRes.data) {
        state.events = eRes.data;
        document.getElementById('statEventsCount').textContent = state.events.filter(function (e) { return e.published; }).length;
        document.getElementById('badgeEventsCount').textContent = state.events.length;
      }
    } catch (err) { console.error('Events load error:', err); }

    // Load Gallery
    try {
      var gRes = await client.from('gallery_items').select('*').order('display_order', { ascending: true });
      if (!gRes.error && gRes.data) {
        state.gallery = gRes.data;
        document.getElementById('statGalleryCount').textContent = state.gallery.filter(function (g) { return g.published; }).length;
        document.getElementById('badgeGalleryCount').textContent = state.gallery.length;
      }
    } catch (err) { console.error('Gallery load error:', err); }

    // Load Trustees
    try {
      var mRes = await client.from('members').select('*').order('display_order', { ascending: true });
      if (!mRes.error && mRes.data) {
        state.members = mRes.data;
        document.getElementById('statTrusteesCount').textContent = state.members.filter(function (m) { return m.active; }).length;
        document.getElementById('badgeTrusteesCount').textContent = state.members.length;
      }
    } catch (err) { console.error('Trustees load error:', err); }

    if (state.activeTab === 'events') renderEventsTable();
    if (state.activeTab === 'gallery') renderGalleryGrid();
    if (state.activeTab === 'trustees') renderTrusteesTable();
  }

  // ============================================================
  // 1. EVENTS MANAGEMENT
  // ============================================================
  function renderEventsTable() {
    var tbody = document.getElementById('eventsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!state.events.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-muted);">No events found. Click "+ Add Event" above to create one.</td></tr>';
      return;
    }

    state.events.forEach(function (e) {
      var tr = document.createElement('tr');
      var dateText = e.is_recurring ? (e.recurrence_rule || e.date_display_en || 'Recurring') : (e.date_display_en || (e.start_date + (e.end_date ? ' to ' + e.end_date : '')));
      var locText = e.location_en || '—';
      var statusClass = e.published ? 'published' : 'draft';
      var statusText = e.published ? 'Published' : 'Draft';

      tr.innerHTML =
        '<td><strong>' + escapeHtml(e.title_en) + '</strong><br><small style="color:var(--admin-muted);">' + escapeHtml(e.title_ta || '') + '</small></td>' +
        '<td>' + (e.is_recurring ? '<span class="status-pill active" style="margin-right:6px;">Recurring</span>' : '') + escapeHtml(dateText) + '</td>' +
        '<td><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:13px;height:13px;margin-right:4px;vertical-align:-1px;color:var(--admin-maroon);"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>' + escapeHtml(locText) + '</td>' +
        '<td><span class="status-pill ' + statusClass + '">' + statusText + '</span></td>' +
        '<td>' + (e.display_order || 0) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm edit-event-btn" data-id="' + e.id + '">Edit</button>' +
          '<button type="button" class="btn btn-danger btn-sm delete-event-btn" data-id="' + e.id + '">Delete</button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-event-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { openEventModal(btn.getAttribute('data-id')); });
    });
    tbody.querySelectorAll('.delete-event-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteEvent(btn.getAttribute('data-id')); });
    });
  }

  function openEventModal(id) {
    var modal = document.getElementById('eventModal');
    var form = document.getElementById('eventForm');
    form.reset();

    var isEdit = !!id;
    document.getElementById('eventModalTitle').textContent = isEdit ? 'Edit Event' : 'Add New Event';
    document.getElementById('eventId').value = id || '';

    if (isEdit) {
      var item = state.events.filter(function (e) { return e.id === id; })[0];
      if (item) {
        document.getElementById('eventSlug').value = item.slug || '';
        document.getElementById('eventTitleEn').value = item.title_en || '';
        document.getElementById('eventTitleTa').value = item.title_ta || '';
        document.getElementById('eventDescEn').value = item.description_en || '';
        document.getElementById('eventDescTa').value = item.description_ta || '';
        document.getElementById('eventIsRecurring').checked = !!item.is_recurring;
        document.getElementById('eventRecurrenceRule').value = item.recurrence_rule || '';
        document.getElementById('eventStartDate').value = item.start_date || '';
        document.getElementById('eventEndDate').value = item.end_date || '';
        document.getElementById('eventDateDisplayEn').value = item.date_display_en || '';
        document.getElementById('eventDateDisplayTa').value = item.date_display_ta || '';
        document.getElementById('eventLocationEn').value = item.location_en || '';
        document.getElementById('eventLocationTa').value = item.location_ta || '';
        document.getElementById('eventPublished').checked = item.published !== false;
        document.getElementById('eventDisplayOrder').value = item.display_order || 0;
      }
    } else {
      document.getElementById('eventPublished').checked = true;
      document.getElementById('eventDisplayOrder').value = state.events.length + 1;
    }

    toggleEventDateFields();
    modal.classList.add('open');
  }

  function toggleEventDateFields() {
    var isRec = document.getElementById('eventIsRecurring').checked;
    var recGroup = document.getElementById('recurrenceGroup');
    var dateGroup = document.getElementById('fixedDateGroup');
    if (recGroup) recGroup.style.display = isRec ? 'block' : 'none';
    if (dateGroup) dateGroup.style.display = isRec ? 'none' : 'grid';
  }

  async function saveEvent(e) {
    e.preventDefault();
    var client = getClient();
    if (!client) return;

    var id = document.getElementById('eventId').value;
    var titleEn = document.getElementById('eventTitleEn').value.trim();
    var titleTa = document.getElementById('eventTitleTa').value.trim() || titleEn;
    var slug = document.getElementById('eventSlug').value.trim() || slugify(titleEn);
    var isRecurring = document.getElementById('eventIsRecurring').checked;

    var record = {
      slug: slug,
      title_en: titleEn,
      title_ta: titleTa,
      description_en: document.getElementById('eventDescEn').value.trim(),
      description_ta: document.getElementById('eventDescTa').value.trim(),
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? document.getElementById('eventRecurrenceRule').value.trim() : null,
      start_date: isRecurring ? null : (document.getElementById('eventStartDate').value || null),
      end_date: isRecurring ? null : (document.getElementById('eventEndDate').value || null),
      date_display_en: document.getElementById('eventDateDisplayEn').value.trim() || (isRecurring ? document.getElementById('eventRecurrenceRule').value.trim() : document.getElementById('eventStartDate').value),
      date_display_ta: document.getElementById('eventDateDisplayTa').value.trim() || document.getElementById('eventDateDisplayEn').value.trim(),
      location_en: document.getElementById('eventLocationEn').value.trim(),
      location_ta: document.getElementById('eventLocationTa').value.trim(),
      published: document.getElementById('eventPublished').checked,
      display_order: parseInt(document.getElementById('eventDisplayOrder').value, 10) || 0,
      updated_at: new Date().toISOString()
    };

    var btn = document.getElementById('saveEventBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      var res;
      if (id) {
        res = await client.from('events').update(record).eq('id', id);
      } else {
        res = await client.from('events').insert([record]);
      }

      if (res.error) {
        alert('Failed to save event: ' + res.error.message);
      } else {
        showToast(id ? 'Event updated successfully.' : 'Event added successfully.');
        document.getElementById('eventModal').classList.remove('open');
        await loadAllData();
      }
    } catch (err) {
      alert('Error saving event: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Event';
    }
  }

  async function deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event?\n\nThis will remove it from the public website automatically.')) return;

    var client = getClient();
    if (!client) return;

    try {
      var res = await client.from('events').delete().eq('id', id);
      if (res.error) {
        alert('Failed to delete event: ' + res.error.message);
      } else {
        showToast('Event deleted from Supabase.');
        await loadAllData();
      }
    } catch (err) {
      alert('Error deleting event: ' + err.message);
    }
  }

  // ============================================================
  // 2. GALLERY MANAGEMENT
  // ============================================================
  function renderGalleryGrid() {
    var container = document.getElementById('galleryAdminGrid');
    if (!container) return;
    container.innerHTML = '';

    if (!state.gallery.length) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:48px; color:var(--admin-muted); background:var(--admin-paper); border-radius:12px; border:1px solid var(--admin-line);">No gallery images found. Click "+ Add Image" above to upload photos.</div>';
      return;
    }

    state.gallery.forEach(function (g) {
      var card = document.createElement('div');
      card.className = 'gallery-admin-card';
      var statusClass = g.published ? 'published' : 'draft';
      var statusText = g.published ? 'Published' : 'Draft';

      card.innerHTML =
        '<div class="gallery-admin-thumb">' +
          '<span class="gallery-admin-badge">' + escapeHtml(g.badge_en || g.category) + '</span>' +
          '<img src="' + escapeHtml(g.image_url) + '" alt="' + escapeHtml(g.title_en) + '" loading="lazy">' +
        '</div>' +
        '<div class="gallery-admin-body">' +
          '<div class="gallery-admin-title">' + escapeHtml(g.title_en) + '</div>' +
          '<small style="color:var(--admin-muted);">' + escapeHtml(g.title_ta || '') + '</small>' +
        '</div>' +
        '<div class="gallery-admin-footer">' +
          '<span class="status-pill ' + statusClass + '">' + statusText + '</span>' +
          '<div class="row-actions">' +
            '<button type="button" class="btn btn-outline btn-sm edit-gallery-btn" data-id="' + g.id + '">Edit</button>' +
            '<button type="button" class="btn btn-danger btn-sm delete-gallery-btn" data-id="' + g.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      container.appendChild(card);
    });

    container.querySelectorAll('.edit-gallery-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { openGalleryModal(btn.getAttribute('data-id')); });
    });
    container.querySelectorAll('.delete-gallery-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteGalleryItem(btn.getAttribute('data-id')); });
    });
  }

  function openGalleryModal(id) {
    var modal = document.getElementById('galleryModal');
    var form = document.getElementById('galleryForm');
    form.reset();

    var isEdit = !!id;
    document.getElementById('galleryModalTitle').textContent = isEdit ? 'Edit Gallery Photo' : 'Upload Gallery Photo';
    document.getElementById('galleryId').value = id || '';
    document.getElementById('galleryImagePath').value = '';

    var preview = document.getElementById('galleryUploadPreview');
    preview.style.display = 'none';
    preview.src = '';

    if (isEdit) {
      var item = state.gallery.filter(function (g) { return g.id === id; })[0];
      if (item) {
        document.getElementById('galleryTitleEn').value = item.title_en || '';
        document.getElementById('galleryTitleTa').value = item.title_ta || '';
        document.getElementById('galleryCategory').value = item.category || 'padi-pooja';
        document.getElementById('galleryBadgeEn').value = item.badge_en || '';
        document.getElementById('galleryBadgeTa').value = item.badge_ta || '';
        document.getElementById('galleryDescEn').value = item.description_en || '';
        document.getElementById('galleryDescTa').value = item.description_ta || '';
        document.getElementById('galleryImageUrl').value = item.image_url || '';
        document.getElementById('galleryImagePath').value = item.image_path || '';
        document.getElementById('galleryPublished').checked = item.published !== false;
        document.getElementById('galleryDisplayOrder').value = item.display_order || 0;

        if (item.image_url) {
          preview.src = item.image_url;
          preview.style.display = 'block';
        }
      }
    } else {
      document.getElementById('galleryPublished').checked = true;
      document.getElementById('galleryDisplayOrder').value = state.gallery.length + 1;
    }

    modal.classList.add('open');
  }

  // Handle local file preview in modal
  function handleFileSelect(e) {
    var file = e.target.files[0];
    if (!file) return;
    var preview = document.getElementById('galleryUploadPreview');
    var reader = new FileReader();
    reader.onload = function (ev) {
      preview.src = ev.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async function saveGalleryItem(e) {
    e.preventDefault();
    var client = getClient();
    if (!client) return;

    var id = document.getElementById('galleryId').value;
    var fileInput = document.getElementById('galleryFileInput');
    var file = fileInput.files[0];
    var imageUrl = document.getElementById('galleryImageUrl').value.trim();
    var imagePath = document.getElementById('galleryImagePath').value.trim();

    if (!file && !imageUrl) {
      alert('Please choose an image file to upload or provide an image URL.');
      return;
    }

    var btn = document.getElementById('saveGalleryBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading image...';

    try {
      // 1. Upload to Supabase Storage if file chosen
      if (file) {
        var fileExt = file.name.split('.').pop();
        var fileName = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) + '.' + fileExt;
        var filePath = 'gallery/' + fileName;

        var uploadRes = await client.storage.from('gallery').upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

        if (uploadRes.error) {
          throw new Error('Storage upload failed: ' + uploadRes.error.message);
        }

        imagePath = filePath;
        var publicRes = client.storage.from('gallery').getPublicUrl(filePath);
        imageUrl = publicRes.data.publicUrl;
      }

      btn.textContent = 'Saving database record...';

      // 2. Save metadata to database
      var category = document.getElementById('galleryCategory').value;
      var badgeEn = document.getElementById('galleryBadgeEn').value.trim() || getCategoryLabel(category);
      var badgeTa = document.getElementById('galleryBadgeTa').value.trim() || badgeEn;

      var record = {
        title_en: document.getElementById('galleryTitleEn').value.trim(),
        title_ta: document.getElementById('galleryTitleTa').value.trim() || document.getElementById('galleryTitleEn').value.trim(),
        description_en: document.getElementById('galleryDescEn').value.trim(),
        description_ta: document.getElementById('galleryDescTa').value.trim(),
        category: category,
        badge_en: badgeEn,
        badge_ta: badgeTa,
        image_path: imagePath || null,
        image_url: imageUrl,
        published: document.getElementById('galleryPublished').checked,
        display_order: parseInt(document.getElementById('galleryDisplayOrder').value, 10) || 0,
        updated_at: new Date().toISOString()
      };

      var res;
      if (id) {
        res = await client.from('gallery_items').update(record).eq('id', id);
      } else {
        res = await client.from('gallery_items').insert([record]);
      }

      if (res.error) {
        alert('Failed to save gallery item: ' + res.error.message);
      } else {
        showToast(id ? 'Gallery photo updated.' : 'Gallery photo uploaded successfully.');
        document.getElementById('galleryModal').classList.remove('open');
        await loadAllData();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Photo';
    }
  }

  async function deleteGalleryItem(id) {
    if (!confirm('Are you sure you want to delete this image?\n\nThis will remove it from the public gallery and cleanup associated storage.')) return;

    var client = getClient();
    if (!client) return;

    try {
      var item = state.gallery.filter(function (g) { return g.id === id; })[0];
      // Cleanup Supabase Storage file if exists
      if (item && item.image_path) {
        try {
          await client.storage.from('gallery').remove([item.image_path]);
        } catch (e) {
          console.warn('Could not remove file from storage:', e);
        }
      }

      var res = await client.from('gallery_items').delete().eq('id', id);
      if (res.error) {
        alert('Failed to delete item: ' + res.error.message);
      } else {
        showToast('Photo deleted successfully.');
        await loadAllData();
      }
    } catch (err) {
      alert('Error deleting image: ' + err.message);
    }
  }

  function getCategoryLabel(cat) {
    var map = {
      'padi-pooja': '18 Padi Pooja',
      'vilakku-pooja': 'Thiru Vilakku Pooja',
      'annadhaanam': 'Annadhaanam',
      'abhishekam': 'Maha Abhishekam',
      'utsavam': 'Mandala Pooja & Utsavam'
    };
    return map[cat] || cat;
  }

  // ============================================================
  // 3. TRUSTEES & COMMITTEE MANAGEMENT
  // ============================================================
  function renderTrusteesTable() {
    var tbody = document.getElementById('trusteesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var filtered = state.members.filter(function (m) {
      if (state.memberGroupFilter !== 'all' && m.group_type !== state.memberGroupFilter) {
        return false;
      }
      if (state.memberSearchQuery) {
        var q = state.memberSearchQuery.toLowerCase();
        return (m.name_en && m.name_en.toLowerCase().indexOf(q) !== -1) ||
               (m.role_en && m.role_en.toLowerCase().indexOf(q) !== -1);
      }
      return true;
    });

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--admin-muted);">No members match your filter.</td></tr>';
      return;
    }

    filtered.forEach(function (m) {
      var tr = document.createElement('tr');
      var statusClass = m.active ? 'active' : 'inactive';
      var statusText = m.active ? 'Active' : 'Inactive';
      var groupLabel = m.group_type === 'apex' ? 'Apex Committee' : 'Present Committee';

      tr.innerHTML =
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="width:34px;height:34px;border-radius:50%;background:var(--admin-maroon);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;font-family:\'Cinzel\',serif;flex:none;">' + escapeHtml(m.initials || 'AB') + '</div>' +
          '<div><strong>' + escapeHtml(m.name_en) + '</strong>' + (m.featured ? ' <span class="status-pill active" style="font-size:10px;">Lead</span>' : '') + '<br><small style="color:var(--admin-muted);">' + escapeHtml(m.name_ta || '') + '</small></div>' +
        '</div></td>' +
        '<td>' + escapeHtml(m.role_en) + '</td>' +
        '<td><span class="status-pill ' + (m.group_type === 'apex' ? 'published' : 'draft') + '">' + groupLabel + '</span></td>' +
        '<td><span class="status-pill ' + statusClass + '">' + statusText + '</span></td>' +
        '<td>' + (m.gothram ? '<span title="' + escapeHtml(m.gothram) + '">G: ' + escapeHtml(m.gothram) + '</span><br>' : '') + (m.rasi ? 'R: ' + escapeHtml(m.rasi) : (m.family_members ? 'Has Family' : '—')) + '</td>' +
        '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm edit-member-btn" data-id="' + m.id + '">Edit</button>' +
          '<button type="button" class="btn btn-danger btn-sm remove-member-btn" data-id="' + m.id + '">Remove</button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-member-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { openMemberModal(btn.getAttribute('data-id')); });
    });
    tbody.querySelectorAll('.remove-member-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { removeMember(btn.getAttribute('data-id')); });
    });
  }

  function openMemberModal(id) {
    var modal = document.getElementById('memberModal');
    var form = document.getElementById('memberForm');
    form.reset();

    var isEdit = !!id;
    document.getElementById('memberModalTitle').textContent = isEdit ? 'Edit Member Profile' : 'Add New Member';
    document.getElementById('memberId').value = id || '';
    document.getElementById('memberIdField').readOnly = isEdit;

    if (isEdit) {
      var m = state.members.filter(function (x) { return x.id === id; })[0];
      if (m) {
        document.getElementById('memberIdField').value = m.id || '';
        document.getElementById('memberNameEn').value = m.name_en || '';
        document.getElementById('memberNameTa').value = m.name_ta || '';
        document.getElementById('memberRoleEn').value = m.role_en || '';
        document.getElementById('memberRoleTa').value = m.role_ta || '';
        document.getElementById('memberGroupType').value = m.group_type || 'present';
        document.getElementById('memberInitials').value = m.initials || '';
        document.getElementById('memberFeatured').checked = !!m.featured;
        document.getElementById('memberActive').checked = m.active !== false;
        document.getElementById('memberDisplayOrder').value = m.display_order || 0;
        document.getElementById('memberFamily').value = m.family_members || '';
        document.getElementById('memberGothram').value = m.gothram || '';
        document.getElementById('memberStar').value = m.nakshatram_star || '';
        document.getElementById('memberRasi').value = m.rasi || '';
      }
    } else {
      document.getElementById('memberActive').checked = true;
      document.getElementById('memberDisplayOrder').value = state.members.length + 1;
    }

    modal.classList.add('open');
  }

  async function saveMember(e) {
    e.preventDefault();
    var client = getClient();
    if (!client) return;

    var nameEn = document.getElementById('memberNameEn').value.trim();
    var id = document.getElementById('memberIdField').value.trim() || slugify(nameEn);
    var isEdit = !!document.getElementById('memberId').value;

    var initials = document.getElementById('memberInitials').value.trim();
    if (!initials) {
      initials = nameEn.split(' ').map(function (w) { return w[0]; }).join('').substring(0, 3).toUpperCase();
    }

    var record = {
      id: id,
      name_en: nameEn,
      name_ta: document.getElementById('memberNameTa').value.trim() || null,
      role_en: document.getElementById('memberRoleEn').value.trim(),
      role_ta: document.getElementById('memberRoleTa').value.trim() || null,
      group_type: document.getElementById('memberGroupType').value,
      initials: initials,
      featured: document.getElementById('memberFeatured').checked,
      active: document.getElementById('memberActive').checked,
      display_order: parseInt(document.getElementById('memberDisplayOrder').value, 10) || 0,
      family_members: document.getElementById('memberFamily').value.trim() || null,
      gothram: document.getElementById('memberGothram').value.trim() || null,
      nakshatram_star: document.getElementById('memberStar').value.trim() || null,
      rasi: document.getElementById('memberRasi').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    var btn = document.getElementById('saveMemberBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      var res;
      if (isEdit) {
        res = await client.from('members').update(record).eq('id', id);
      } else {
        res = await client.from('members').insert([record]);
      }

      if (res.error) {
        alert('Failed to save member: ' + res.error.message);
      } else {
        showToast(isEdit ? 'Member details updated.' : 'New member added successfully.');
        document.getElementById('memberModal').classList.remove('open');
        await loadAllData();
      }
    } catch (err) {
      alert('Error saving member: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Member';
    }
  }

  async function removeMember(id) {
    if (!confirm('Are you sure you want to remove this member?\n\nThis will take them off the public website.')) return;

    var client = getClient();
    if (!client) return;

    try {
      // Soft-delete (set active = false) or hard delete if confirmed
      var res = await client.from('members').delete().eq('id', id);
      if (res.error) {
        alert('Failed to remove member: ' + res.error.message);
      } else {
        showToast('Member removed from Supabase.');
        await loadAllData();
      }
    } catch (err) {
      alert('Error removing member: ' + err.message);
    }
  }

  // ============================================================
  // 4. SETTINGS & CONFIGURATION
  // ============================================================
  function populateSettingsForm() {
    var cfg = window.ABASS_API ? window.ABASS_API.getConfig() : {};
    document.getElementById('settingsUrl').value = cfg.url || '';
    document.getElementById('settingsKey').value = cfg.anonKey || '';
  }

  function saveSettings(e) {
    e.preventDefault();
    var url = document.getElementById('settingsUrl').value.trim();
    var key = document.getElementById('settingsKey').value.trim();

    if (window.ABASS_API) {
      window.ABASS_API.setConfig(url, key);
      showToast('Supabase configuration saved to this browser.');
      checkAuth();
    }
  }

  async function testConnection() {
    var url = document.getElementById('settingsUrl').value.trim();
    var key = document.getElementById('settingsKey').value.trim();
    var statusEl = document.getElementById('testConnStatus');
    statusEl.textContent = 'Testing connection...';
    statusEl.style.color = 'var(--admin-navy)';

    try {
      var testClient = window.supabase.createClient(url, key);
      var res = await testClient.from('events').select('id').limit(1);
      if (res.error) {
        statusEl.textContent = 'Connection test failed: ' + res.error.message;
        statusEl.style.color = 'var(--admin-red)';
      } else {
        statusEl.textContent = 'Connection successful! Supabase responded properly.';
        statusEl.style.color = 'var(--admin-green)';
      }
    } catch (err) {
      statusEl.textContent = 'Connection error: ' + (err.message || err);
      statusEl.style.color = 'var(--admin-red)';
    }
  }

  // --- HELPERS ---
  function slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', function () {
    // Auth listeners
    var loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    var deniedLogoutBtn = document.getElementById('deniedLogoutBtn');
    if (deniedLogoutBtn) deniedLogoutBtn.addEventListener('click', handleLogout);

    var forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) forgotPasswordLink.addEventListener('click', handleForgotPassword);

    var resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) resetPasswordForm.addEventListener('submit', handleResetPassword);

    var returnToLoginBtn = document.getElementById('returnToLoginBtn');
    if (returnToLoginBtn) returnToLoginBtn.addEventListener('click', returnToLogin);

    var cancelResetBtn = document.getElementById('cancelResetBtn');
    if (cancelResetBtn) cancelResetBtn.addEventListener('click', returnToLogin);

    var client = getClient();
    if (client && client.auth) {
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'PASSWORD_RECOVERY') {
          state.isRecoveringPassword = true;
          showResetPasswordScreen();
        }
      });
    }

    // Tab buttons
    document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    // Modals
    var addEventBtn = document.getElementById('addEventBtn');
    if (addEventBtn) addEventBtn.addEventListener('click', function () { openEventModal(); });
    var eventForm = document.getElementById('eventForm');
    if (eventForm) eventForm.addEventListener('submit', saveEvent);
    var eventIsRecurring = document.getElementById('eventIsRecurring');
    if (eventIsRecurring) eventIsRecurring.addEventListener('change', toggleEventDateFields);

    var addGalleryBtn = document.getElementById('addGalleryBtn');
    if (addGalleryBtn) addGalleryBtn.addEventListener('click', function () { openGalleryModal(); });
    var galleryForm = document.getElementById('galleryForm');
    if (galleryForm) galleryForm.addEventListener('submit', saveGalleryItem);
    var galleryFileInput = document.getElementById('galleryFileInput');
    if (galleryFileInput) galleryFileInput.addEventListener('change', handleFileSelect);

    var addMemberBtn = document.getElementById('addMemberBtn');
    if (addMemberBtn) addMemberBtn.addEventListener('click', function () { openMemberModal(); });
    var memberForm = document.getElementById('memberForm');
    if (memberForm) memberForm.addEventListener('submit', saveMember);

    // Trustee filters
    var memberFilterApex = document.getElementById('memberFilterApex');
    var memberFilterPresent = document.getElementById('memberFilterPresent');
    var memberFilterAll = document.getElementById('memberFilterAll');
    var memberSearch = document.getElementById('memberSearch');

    function updateMemberGroupFilter(group, activeBtn) {
      state.memberGroupFilter = group;
      [memberFilterAll, memberFilterApex, memberFilterPresent].forEach(function (b) { if (b) b.classList.remove('active'); });
      if (activeBtn) activeBtn.classList.add('active');
      renderTrusteesTable();
    }
    if (memberFilterAll) memberFilterAll.addEventListener('click', function () { updateMemberGroupFilter('all', memberFilterAll); });
    if (memberFilterApex) memberFilterApex.addEventListener('click', function () { updateMemberGroupFilter('apex', memberFilterApex); });
    if (memberFilterPresent) memberFilterPresent.addEventListener('click', function () { updateMemberGroupFilter('present', memberFilterPresent); });
    if (memberSearch) {
      memberSearch.addEventListener('input', function (e) {
        state.memberSearchQuery = e.target.value.trim();
        renderTrusteesTable();
      });
    }

    // Modal close buttons
    document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.modal-backdrop').forEach(function (m) { m.classList.remove('open'); });
      });
    });

    // Settings
    var settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.addEventListener('submit', saveSettings);
    var testConnBtn = document.getElementById('testConnBtn');
    if (testConnBtn) testConnBtn.addEventListener('click', testConnection);

    // Check auth session
    checkAuth();
  });
})();
