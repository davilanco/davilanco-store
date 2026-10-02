async function sendMessage(userId, nickname) {
  var textEl = document.getElementById('msgText-' + userId);
  var text = (textEl && textEl.value || '').trim();
  if (!text) { alert('Type a message first'); return; }
  try {
    var res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: adminUser.id,
        sender_role: 'admin',
        sender_name: 'Admin',
        receiver_id: userId,
        receiver_role: 'customer',
        message: text
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Failed');
    textEl.value = '';
    showToast('Message sent');
  } catch (err) {
    alert(err.message || 'Failed');
  }
}
