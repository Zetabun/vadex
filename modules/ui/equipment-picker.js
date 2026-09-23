// In-game equipment selection. Selection previews an item; only Apply changes the loadout.
import { h, clear } from '@last-orbit/ui/dom.js';
import { openModal, closeModal } from '@last-orbit/ui/modals.js';
import { gameIcon } from '@last-orbit/ui/icons.js';

export function equipmentPicker({ title, subtitle, options = [], value = '', preferred, lockedMessage, onApply, onClose, applyLabel }) {
  const current = String(value ?? '');
  let selected = String(preferred ?? current), query = '';
  if (!options.some(x => String(x.id) === selected)) selected = String(options[0]?.id ?? '');
  const list = h('div.equipment-options', { 'aria-label': 'Compatible equipment' });
  const preview = h('section.equipment-preview', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const message = h('p.equipment-message', { role: 'status' });
  const apply = h('button.btn.pri', { onclick: () => {
    const choice = options.find(x => String(x.id) === selected);
    if (!choice || apply.disabled) return;
    if (onApply?.(choice.id) === false) { message.textContent = 'This equipment is no longer available for this slot. Close and reopen to refresh.'; return; }
    closeModal();
  } });
  const cancel = h('button.btn', { onclick: closeModal }, lockedMessage ? 'Close' : 'Cancel');
  const search = options.length > 6 ? h('input.equipment-search', { type: 'search', placeholder: 'Search compatible equipment…', 'aria-label': 'Search compatible equipment', oninput: () => { query = search.value.trim().toLowerCase(); drawList(); } }) : null;
  const dialog = h('div.dlg.equipment-dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('header.equipment-header', h('div', h('small', 'SHIP EQUIPMENT'), h('h2', title), h('p', subtitle || 'Choose equipment, review its details, then confirm.')), h('button.equipment-close', { 'aria-label': 'Close equipment picker', onclick: closeModal }, '✕')),
    h('div.equipment-scroll', search, lockedMessage ? h('p.equipment-empty', lockedMessage) : [list, preview], message),
    h('footer.equipment-footer', cancel, lockedMessage ? null : apply));

  function drawPreview() {
    const item = options.find(x => String(x.id) === selected);
    clear(preview);
    if (!item) { apply.disabled = true; return; }
    preview.style.setProperty('--item-accent', item.accent || 'var(--cyan)');
    preview.append(h('small', selected === current ? 'CURRENTLY FITTED' : 'SELECTED EQUIPMENT'), h('h3', item.name), h('p', item.desc || ''),
      ...(item.rows || []).map(([label, text]) => h('div.equipment-stat', h('span', label), h('b', text))));
    if (item.location) preview.append(h('p.equipment-move-note', item.location));
    apply.disabled = selected === current || !!item.disabled;
    apply.textContent = selected === current ? 'Currently fitted' : applyLabel || (selected === '' ? 'Remove equipment' : 'Equip');
  }
  function drawList() {
    clear(list);
    const shown = options.filter(x => !query || `${x.name} ${x.meta || ''}`.toLowerCase().includes(query));
    if (!shown.length) list.append(h('p.equipment-empty', 'No matching equipment. Try another search.'));
    for (const item of shown) {
      const id = String(item.id);
      list.append(h('button.equipment-option' + (id === selected ? '.selected' : ''), {
        type: 'button', style: `--item-accent:${item.accent || 'var(--cyan)'}`, 'aria-pressed': String(id === selected), disabled: !!item.disabled,
        onclick: (event) => { selected = id; for (const button of list.querySelectorAll('button')) { const on = button === event.currentTarget; button.classList.toggle('selected', on); button.setAttribute('aria-pressed', String(on)); } drawPreview(); },
      }, h('i', item.artKind ? gameIcon(item.artKind, item.artId, 'equipment-pixel', item.icon || '◇') : (item.icon || '◇')), h('span', h('b', item.name), h('small', item.meta || (id === '' ? 'Leave this slot empty' : 'Compatible equipment'))), h('em', id === current ? 'FITTED' : item.location ? 'IN USE' : '')));
    }
  }
  if (!lockedMessage) { drawList(); drawPreview(); }
  openModal(dialog, { onClose });
  return dialog;
}
