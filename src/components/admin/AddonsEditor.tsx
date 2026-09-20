// ============================================
// Bite Me Baby — Admin Add-ons / Toppings Editor
// Visual form builder for products.addons (gated by the browser):
//   - add / remove topping groups (radio / checkbox / text),
//   - set name, price (+฿), max selections and the option list,
// and emits the JSON array shape that is stored in products.addons by the
// product form (no raw JSON typing anywhere in the admin flow).
// ============================================

export interface AddonDraft {
  id: string
  name: string
  price: number
  type: 'radio' | 'checkbox' | 'text'
  options: string[]
  max_selections: number
}

export function emptyAddonGroup(): AddonDraft {
  return {
    id: 'ad-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    name: '',
    price: 0,
    type: 'checkbox',
    options: [''],
    max_selections: 1,
  }
}

export function toAddonDrafts(value: unknown): AddonDraft[] {
  const raw: any[] = Array.isArray(value) ? value : []
  return raw.map((a) => ({
    id: String(a?.id ?? 'ad-' + Math.random().toString(36).slice(2, 8)),
    name: String(a?.name ?? ''),
    price: Number(a?.price) || 0,
    type: a?.type === 'text' ? 'text' : (a?.type === 'radio' ? 'radio' : 'checkbox'),
    options: Array.isArray(a?.options) ? a?.options.map(String) : [],
    max_selections: Number(a?.max_selections) || 1,
  }))
}

/** Filter empty rows and map back to the products.addons JSON shape. */
export function addonDraftsToJson(drafts: AddonDraft[]): AddonDraft[] {
  return drafts
    .filter((d) => d.name.trim() !== '')
    .map((d) => ({
      id: d.id || ('ad-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      name: d.name.trim(),
      price: Number(d.price) || 0,
      type: d.type,
      options: d.options.map((o) => o.trim()).filter((o) => o !== ''),
      max_selections: Math.max(1, Number(d.max_selections) || 1),
    }))
}

interface Props {
  value: AddonDraft[]
  onChange: (next: AddonDraft[]) => void
}

export function AddonsEditor({ value, onChange }: Props) {
  const setGroup = (gi: number, patch: Partial<AddonDraft>) => {
    const next = value.map((g, i) => (i === gi ? { ...g, ...patch } : g))
    onChange(next)
  }
  const setOption = (gi: number, oi: number, text: string) => {
    const next = value.map((g, i) => (i === gi ? { ...g, options: g.options.map((o, j) => (j === oi ? text : o)) } : g))
    onChange(next)
  }
  const removeOption = (gi: number, oi: number) => {
    const next = value.map((g, i) => (i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g))
    onChange(next)
  }
  const addOption = (gi: number) => {
    const next = value.map((g, i) => (i === gi ? { ...g, options: [...g.options, ''] } : g))
    onChange(next)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-brand-accent">🧁 Toppings / Add-ons</h4>
        <button
          type="button"
          onClick={() => onChange([...value, emptyAddonGroup()])}
          className="btn btn-outline text-sm"
          data-testid="add-addon-group"
        >
          ➕ เพิ่มกลุ่ม
        </button>
      </div>
      <p className="text-xs text-brand-muted mb-3">
        กลุ่มตัวเลือก (toppings) ที่ลูกค้าเลือกได้หน้าร้าน — ระบบบันทึกเป็น JSON อัตโนมัติโดยไม่ต้องพิมพ์โค้ดเลย
      </p>
{value.length === 0 && (
        <p className="text-sm text-brand-muted italic">ยังไม่มี topping — กด "เพิ่มกลุ่ม" เพื่อเริ่ม</p>
      )}

      <div className="space-y-3" data-testid="addon-groups">
        {value.map((group, gi) => (
          <div key={group.id} className="rounded-xl border border-brand-border bg-white p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-brand-accent mb-1">ชื่อกลุ่ม (เช่น เพิ่มชีส +15฿)</label>
                <input
                  type="text"
                  value={group.name}
                  data-testid="addon-group-name"
                  onChange={(e) => setGroup(gi, { name: e.target.value })}
                  className="input py-1.5 text-sm"
                  placeholder="e.g. Extra cheese / เพิ่มไข่ดาว"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-accent mb-1">ราคา (+฿)</label>
                <input
                  type="number"
                  min={0}
                  value={group.price || ''}
                  data-testid="addon-group-price"
                  onChange={(e) => setGroup(gi, { price: parseFloat(e.target.value) || 0 })}
                  className="input py-1.5 text-sm"
                  placeholder="15"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-accent mb-1">เลือกได้กี่อย่าง</label>
                <input
                  type="number"
                  min={1}
                  value={group.max_selections || 1}
                  onChange={(e) => setGroup(gi, { max_selections: parseInt(e.target.value) || 1 })}
                  className="input py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-brand-accent mb-1">ประเภท</label>
                <select
                  value={group.type}
                  onChange={(e) => setGroup(gi, { type: e.target.value as AddonDraft['type'] })}
                  className="input py-1.5 text-sm"
                >
                  <option value="checkbox">Checkbox — เลือกได้หลายอย่าง</option>
                  <option value="radio">Radio — เลือกได้อย่างเดียว</option>
                  <option value="text">Text — กรอกข้อความ</option>
                </select>
              </div>
              <div className="md:col-span-2 flex items-end justify-end">
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== gi))}
                  className="btn btn-outline text-sm text-red-500"
                >
                  🗑️ ลบกลุ่ม
                </button>
              </div>
            </div>

            {group.type !== 'text' && (
              <div className="mt-2">
                <label className="block text-xs font-medium text-brand-accent mb-1">ตัวเลือก (เช่น ปกติ / ชีสเพิ่ม / ชีสเพิ่ม x2)</label>
                <div className="flex flex-wrap items-center gap-2">
                  {group.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => setOption(gi, oi, e.target.value)}
                        className="input py-1 px-2 text-sm w-32"
                        placeholder={`ตัวเลือก ${oi + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(gi, oi)}
                        className="text-sm text-red-500 hover:underline px-1"
                        aria-label="ลบตัวเลือก"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addOption(gi)} className="btn btn-outline text-xs">
                    + เพิ่มตัวเลือก
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}