# Bite Me Baby — คู่มือผู้ดูแลระบบ (Admin · Thai)

> ปปรับ 2026-09-21 — เขιхทΎមเขียนทбตามจริงของระบบ (overwrite, не append)

---

## 1) เข้าสู่ระบบ (Login)

- เปิด веб 그리고กд **เข้าสู่ระบบ** (email + password)
- ผู้ดูแลระบบ = profile ที่มี role = `admin` (системаตรวจด้วย server/RLS)
- После входа —กд **Admin** сверX справа либо откройте `/admin`
- Если role ещё не admin, بنетво owner проmote:
  `select public.promote_to_full_admin('you@example.com');`

## 2) Дашборд (Dashboard) и навигация

- `/admin` — обзор бизнес: 오더рวันนี้ · раийдวันนี้ · pending · delivered · low stock · ลূকКА
- **AdminNav** (панель сверX на каждой admin-странице): переключение раздеов в один клик
- На мобильном — кнопка **Dashboard**: вернуться в панель можно всегда
- Разделы: Dashboard · Orders · Menu · Approvals · Rounds · Promos · Customers · Inventory · Media · Settings · Delivery · Route · Audit · Errors · Mascot · Control

## 3) Меню и Categories

- `+ เพдбမူ` — имя · цена · category · prep time · описание · изображение
- **Image**: загрузить файл (preview) **или** вставить URL; **Remove image** — удалить выбор
- Вч belt вида: продаётся / скрыто · Add-ons (цены считает server)
- **Category headings** (блок ниже списка меню):
  * `+ New heading` — новый заголえвок категории (name + icon + order + active)
  * Edit — переименовать/икоنка/порядок/скрыть · Delete — только когда пусто
  * Сохранённая категория сразу видна покупателям

## 4) Контент-проверка (Content Approvals · PHASE 7)

- Страница `/admin/content-approvals` — submit (тип + title + body)
- Публикация **только** после `approved` — авто-публикации нет
- Админ: **Approve** / **Reject** + comment
- Банеры из Promotions автоматически идут на approval

## 5) Таблица страниц

| URL | Назначение |
|-----|-------------|
| `/admin` | Дашборд |
| `/admin/orders` | Заказы, статусы |
| `/admin/products` | Меню + категории |
| `/admin/rounds` | Раунды, лимиты |
| `/admin/promotions` | Промо/купноны/banner |
| `/admin/content-approvals` | Approval |
| `/admin/customers` | Клиенты |
| `/admin/inventory` | Ингредиенты/склад |
| `/admin/media` | Медиа (bmb-images) |
| `/admin/settings` | Настройки |
| `/admin/delivery` | Bite Drive + external |
| `/admin/route-optimization` | Маршруты |
| `/admin/audit-log` | Лог действий |
| `/admin/errors` | Ошибки |
| `/admin/mascot` | Маскот |
| `/admin/control` | Квота/Rider |
| `/rider` | Rider PWA |

## 6) Deploy

- Cloudflare Pages: `git push origin main` → авто-deploy
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENROUTER_API_KEY`
- ⛔ Никогда не кладitите `service_role` key в frontend
- Миграции 001→022 применяет владелец (`supabase db push` / SQL Editor)
- Перед push: `npm test` + `npm run build` + `npm run lint`

— конец —
