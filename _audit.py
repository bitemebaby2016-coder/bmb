import os, re

print('=== CODEBASE STATUS AUDIT ===')
print()

# Components
print('1. COMPONENTS')
components = ['FoodMenuCard', 'Header', 'Footer', 'BottomNav', 'Layout']
for c in components:
    path = f'src/components/layout/{c}.tsx' if c != 'FoodMenuCard' else f'src/components/{c}.tsx'
    if os.path.exists(path):
        print(f'  [OK] {c}')
    else:
        print(f'  [X] {c}')

# Pages
print('\n2. PAGES')
pages = ['HomePage', 'MenuPage', 'CartPage', 'CheckoutPage', 'OrderTrackPage', 
         'ProfilePage', 'PromotionsPage', 'ReviewPage', 'VotePage', 
         'RandomMenuPage', 'RewardsPage', 'SharePage', 'ViralPage',
         'LoginPage', 'RegisterPage', 'AiChatPage',
         'AboutPage', 'FaqPage', 'BlogPage', 'ContactPage', 'PrivacyPage', 'TermsPage']
for p in pages:
    path = f'src/pages/{p}.tsx'
    if os.path.exists(path):
        content = open(path, encoding='utf-8', errors='ignore').read()
        status = '[OK] FULL' if len(content) > 100 else '[~] PLACEHOLDER'
        print(f'  {status} {p}')
    else:
        print(f'  [X] {p}')

# Admin
print('\n3. ADMIN PAGES')
admins = ['AdminDashboard', 'InventoryPage', 'AdminOrders', 'AdminProducts']
for a in admins:
    path = f'src/pages/admin/{a}.tsx'
    if os.path.exists(path):
        content = open(path, encoding='utf-8', errors='ignore').read()
        status = '[OK] FULL' if len(content) > 100 else '[~] PLACEHOLDER'
        print(f'  {status} {a}')
    else:
        print(f'  [X] {a}')

# Services
print('\n4. SERVICES')
if os.path.exists('src/services/imageProductionService.ts'):
    print('  [~] imageProductionService (should be deleted)')
else:
    print('  [OK] imageProductionService: DELETED')

# Libs
print('\n5. LIBRARIES')
libs = ['aiService', 'supabase', 'bmbStorage', 'seo', 'storage', 'utils',
        'bmbAdminApi_orders', 'bmbAdminApi_products', 'bmbAdminApi_inventory', 'bmbAdminApi_users']
for l in libs:
    path = f'src/lib/{l}.ts'
    if os.path.exists(path):
        content = open(path, encoding='utf-8', errors='ignore').read()
        status = '[OK] FULL' if len(content) > 100 else '[~] PLACEHOLDER'
        print(f'  {status} {l}')
    else:
        print(f'  [X] {l}')

# Stores
print('\n6. STORES')
stores = ['authStore', 'cartStore', 'inventoryStore', 'rewardsStore']
for s in stores:
    path = f'src/store/{s}.ts'
    if os.path.exists(path):
        content = open(path, encoding='utf-8', errors='ignore').read()
        status = '[OK] FULL' if len(content) > 100 else '[~] PLACEHOLDER'
        print(f'  {status} {s}')
    else:
        print(f'  [X] {s}')

print('\n=== DONE ===')
