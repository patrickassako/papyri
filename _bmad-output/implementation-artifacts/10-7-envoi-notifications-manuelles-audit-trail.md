# Story 10.7: Envoi Notifications Manuelles & Audit Trail

Status: ready-for-dev

## Story

As a administrateur,
I want envoyer des notifications push manuelles et consulter l'historique des actions admin,
So that je puisse communiquer avec les utilisateurs et verifier les operations.

## Acceptance Criteria

1. **AC1 — Composer notification** : Given un admin, When il compose une notification, Then il saisit : titre, message, type (maintenance/nouveaute/info), cible (tous/segment)
2. **AC2 — Envoi FCM** : Given une notification composee, When elle est envoyee, Then elle est transmise via Firebase FCM a tous les utilisateurs ayant active les notifications administratives
3. **AC3 — Apercu + confirmation** : Given une notification prete, When l'admin valide, Then un apercu s'affiche avec confirmation obligatoire
4. **AC4 — Consulter audit trail** : Given un admin, When il consulte l'historique, Then il voit toutes les actions : date, admin, action, ressource, details
5. **AC5 — Filtres audit** : Given l'historique, When l'admin filtre, Then il peut filtrer par admin, type action, periode
6. **AC6 — Lecture seule** : Given l'audit trail, When consulte, Then aucune suppression n'est possible (lecture seule)

## Tasks / Subtasks

- [ ] **Task 1 : Formulaire notification** (AC: #1, #3)
  - [ ] 1.1 Page AdminJS custom "/admin/notifications/send"
  - [ ] 1.2 Formulaire : titre, message, type, cible
  - [ ] 1.3 Apercu avant envoi
  - [ ] 1.4 Bouton confirmation "Envoyer maintenant"

- [ ] **Task 2 : Service notification FCM** (AC: #2)
  - [ ] 2.1 Creer `backend/src/services/fcm.service.js`
  - [ ] 2.2 Firebase Admin SDK setup
  - [ ] 2.3 Fonction `sendNotificationToAll(title, body, data)`
  - [ ] 2.4 Recuperer tous les FCM tokens actifs
  - [ ] 2.5 Batch send (500 tokens max par appel FCM)

- [ ] **Task 3 : Ressource Audit Logs** (AC: #4, #5, #6)
  - [ ] 3.1 Ressource `audit_logs` AdminJS (lecture seule)
  - [ ] 3.2 Afficher : date, admin (email), action, resource, details (JSON pretty)
  - [ ] 3.3 Filtres : admin_id, action, date range
  - [ ] 3.4 Desactiver edit/delete (read-only)

- [ ] **Task 4 : Tests** (AC: #1, #2, #3, #4)
  - [ ] 4.1 Test envoi notification a 1 user
  - [ ] 4.2 Test batch send 1000 users
  - [ ] 4.3 Test audit trail liste complete
  - [ ] 4.4 Test filtres audit fonctionnent

## Dev Notes

### FCM Service

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../config/firebase-admin.json'))
});

async function sendNotificationToAll(title, body, data = {}) {
  // Get all active FCM tokens
  const { data: tokens } = await supabaseAdmin
    .from('notification_preferences')
    .select('fcm_token')
    .eq('push_enabled', true)
    .not('fcm_token', 'is', null);

  const fcmTokens = tokens.map(t => t.fcm_token);

  // Batch send (500 max per call)
  const batches = [];
  for (let i = 0; i < fcmTokens.length; i += 500) {
    batches.push(fcmTokens.slice(i, i + 500));
  }

  const results = [];
  for (const batch of batches) {
    const result = await admin.messaging().sendMulticast({
      tokens: batch,
      notification: { title, body },
      data,
    });
    results.push(result);
  }

  return results;
}
```

## Dev Agent Record

<!-- Agent will fill this -->
