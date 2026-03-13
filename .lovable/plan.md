

# Guide de transition vers le plan gratuit Lovable

## Erreur de build à corriger d'abord

Il y a une erreur TypeScript dans `src/pages/Capture.tsx` ligne 49 : `Cannot find namespace 'NodeJS'`. Il faut remplacer le type `NodeJS.Timeout` par `ReturnType<typeof setInterval>`.

---

## Étapes pour passer au plan gratuit en toute sérénité

### 1. Vérifier que le code est bien sur GitHub
- Va dans **Settings → GitHub** dans Lovable
- Confirme que ton repo est connecté et synchronisé
- Ton code frontend est sauvegardé indépendamment de ton abonnement

### 2. Exporter tes données (précaution)
- Va dans **Cloud → Database → Tables**
- Pour chaque table (profiles, user_roles, classes), clique sur **Export** pour télécharger en CSV
- Garde ces fichiers en local comme sauvegarde

### 3. Télécharger tes fichiers audio (précaution)
- Les audios dans le bucket `audio-submissions` restent accessibles sur le plan gratuit
- Pour une sauvegarde locale, tu peux les télécharger via l'interface Cloud → Storage

### 4. Noter tes variables d'environnement
- Copie ces 3 valeurs quelque part en sécurité :
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- Tu en auras besoin si tu déploies ailleurs (Vercel, Netlify)

### 5. Publier la dernière version
- Clique sur **Publish → Update** pour que la version live soit à jour avant de changer de plan

### 6. Changer de plan
- Va dans **Settings → Plans & Credits**
- Passe au plan Free
- Confirme le changement

---

## Ce qui reste après la transition

| Élément | Statut |
|---------|--------|
| Code sur GitHub | ✅ Intact |
| Base de données | ✅ Accessible (25$/mois de crédit Cloud gratuit) |
| Fichiers audio | ✅ Accessibles |
| Authentification | ✅ Fonctionnelle |
| Edge Functions | ✅ Fonctionnelles |
| Application publiée | ✅ En ligne |
| Édition par IA (chat) | ⚠️ 5 crédits/jour, max 30/mois |
| Édition manuelle du code | ❌ Nécessite un plan payant dans Lovable |
| Édition via GitHub/IDE | ✅ Toujours possible, sync automatique |

## Correction technique

Fichier `src/pages/Capture.tsx`, ligne 49 : remplacer `NodeJS.Timeout` par `ReturnType<typeof setInterval>` pour corriger l'erreur de build.

