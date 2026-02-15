# Story 10.2: Gestion Utilisateurs

Status: ready-for-dev

## Story

As a administrateur,
I want consulter, rechercher et gerer les comptes utilisateurs,
So that je puisse assurer le support et la moderation.

## Acceptance Criteria

1. **AC1 — Liste paginee** : Given un admin sur la section Utilisateurs, When il consulte la liste, Then il voit les utilisateurs avec email, nom, date inscription, statut (actif/desactive), type abonnement
2. **AC2 — Recherche** : Given un admin, When il saisit un email ou nom, Then la liste filtre les resultats
3. **AC3 — Detail utilisateur** : Given un admin qui clique sur un utilisateur, When il consulte le detail, Then il voit : profil, historique activite (lectures, ecoutes, paiements), statut abonnement
4. **AC4 — Activation/Desactivation** : Given un admin, When il desactive un compte, Then l'acces est coupe immediatement (token invalide) et contenus hors-ligne purges
5. **AC5 — Audit trail** : Given une action admin, When elle est effectuee, Then elle est tracee dans audit_logs

## Tasks / Subtasks

- [ ] **Task 1 : Ajouter ressource Users dans AdminJS** (AC: #1, #2)
  - [ ] 1.1 Configurer ressource `users` avec proprietes : id, email, full_name, role, is_active, created_at
  - [ ] 1.2 Ajouter filtres : statut (actif/inactif), role (user/admin), date inscription
  - [ ] 1.3 Ajouter recherche par email et full_name
  - [ ] 1.4 Pagination 20 items/page

- [ ] **Task 2 : Page detail utilisateur** (AC: #3)
  - [ ] 2.1 Afficher profil complet
  - [ ] 2.2 Afficher abonnement actif (plan, periode, statut)
  - [ ] 2.3 Afficher historique lecture (derniers 10 contenus)
  - [ ] 2.4 Afficher historique paiements (derniers 10)

- [ ] **Task 3 : Actions activation/desactivation** (AC: #4)
  - [ ] 3.1 Bouton "Desactiver/Activer" sur page detail
  - [ ] 3.2 Confirmation obligatoire avant desactivation
  - [ ] 3.3 Mise a jour colonne `is_active` en base
  - [ ] 3.4 Invalidation token JWT (blacklist temporaire ou refresh force)
  - [ ] 3.5 Purge contenus hors-ligne si desactivation

- [ ] **Task 4 : Audit trail** (AC: #5)
  - [ ] 4.1 Logger activation : action="activate", resource="users"
  - [ ] 4.2 Logger desactivation : action="deactivate", resource="users"

- [ ] **Task 5 : Tests** (AC: #1, #2, #3, #4)
  - [ ] 5.1 Test : liste utilisateurs affichee
  - [ ] 5.2 Test : recherche par email fonctionne
  - [ ] 5.3 Test : desactivation coupe acces immediat
  - [ ] 5.4 Test : audit log cree

## Dev Notes

### Configuration AdminJS

```javascript
{
  resource: Users,
  options: {
    properties: {
      password_hash: { isVisible: false }, // Masquer hash
      is_active: {
        availableValues: [
          { value: true, label: 'Actif' },
          { value: false, label: 'Desactive' }
        ]
      }
    },
    actions: {
      edit: {
        before: async (request) => {
          // Empecher modification email (unicite)
          delete request.payload.email;
          return request;
        }
      },
      toggleActive: {
        actionType: 'record',
        component: false,
        handler: async (request, response, context) => {
          const user = await context.record.populate();
          const newStatus = !user.params.is_active;

          await supabaseAdmin
            .from('users')
            .update({ is_active: newStatus })
            .eq('id', user.id);

          await logAuditEvent(
            context.currentAdmin.id,
            newStatus ? 'activate' : 'deactivate',
            'users',
            user.id
          );

          return {
            record: user.toJSON(),
            notice: {
              message: `Utilisateur ${newStatus ? 'active' : 'desactive'}`,
              type: 'success'
            }
          };
        }
      }
    }
  }
}
```

### References

- [Source: _bmad-output/db_schema.md#Table users]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2]

## Dev Agent Record

### Agent Model Used

<!-- Agent will fill this -->

### File List

<!-- Agent will list all files created/modified -->
