# Story 10.3: Gestion Abonnements

Status: ready-for-dev

## Story

As a administrateur,
I want gerer manuellement les abonnements des utilisateurs,
So that je puisse traiter les cas exceptionnels (support, geste commercial, bug paiement).

## Acceptance Criteria

1. **AC1 — Liste filtrable** : Given un admin sur Abonnements, When il consulte la liste, Then il voit : utilisateur, plan, date debut/fin, statut, passerelle avec filtres (actifs, expires, annules)
2. **AC2 — Activation manuelle** : Given un admin, When il active un abonnement, Then le statut passe a "active" et l'utilisateur a acces
3. **AC3 — Prolongation** : Given un admin, When il prolonge un abonnement, Then la date current_period_end est ajustee
4. **AC4 — Annulation** : Given un admin, When il annule un abonnement, Then le statut passe a "cancelled" et l'acces reste actif jusqu'a fin de periode
5. **AC5 — Motif obligatoire** : Given une action admin, When elle est effectuee, Then un motif est requis et logue dans audit_logs

## Tasks / Subtasks

- [ ] **Task 1 : Ressource Subscriptions AdminJS** (AC: #1)
  - [ ] 1.1 Ajouter ressource `subscriptions`
  - [ ] 1.2 Filtres : statut (active, inactive, expired, cancelled), passerelle (stripe, flutterwave)
  - [ ] 1.3 Afficher : user email (jointure), plan, periode, statut

- [ ] **Task 2 : Actions manuelles** (AC: #2, #3, #4)
  - [ ] 2.1 Action "Activer" : set status=active, period_end=+30j ou +365j
  - [ ] 2.2 Action "Prolonger" : ajouter jours a current_period_end
  - [ ] 2.3 Action "Annuler" : set status=cancelled, cancelled_at=now

- [ ] **Task 3 : Formulaire motif** (AC: #5)
  - [ ] 3.1 Popup demande motif avant action
  - [ ] 3.2 Motif stocke dans audit_logs.details

- [ ] **Task 4 : Tests** (AC: #1, #2, #3, #4, #5)
  - [ ] 4.1 Test activation manuelle
  - [ ] 4.2 Test prolongation +7j
  - [ ] 4.3 Test annulation conserve acces jusqu'a fin
  - [ ] 4.4 Test motif requis et logue

## Dev Notes

### Actions AdminJS

```javascript
{
  resource: Subscriptions,
  options: {
    actions: {
      activateManually: {
        actionType: 'record',
        handler: async (request, response, context) => {
          const reason = request.payload.reason;
          if (!reason) {
            throw new Error('Motif obligatoire');
          }

          const subscription = await context.record.populate();
          const plan = subscription.params.plan;
          const duration = plan === 'monthly' ? 30 : 365;

          await supabaseAdmin
            .from('subscriptions')
            .update({
              status: 'active',
              current_period_start: new Date(),
              current_period_end: new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
            })
            .eq('id', subscription.id);

          await logAuditEvent(
            context.currentAdmin.id,
            'activate_manually',
            'subscriptions',
            subscription.id,
            { reason, plan, duration }
          );

          return { record: subscription.toJSON() };
        }
      }
    }
  }
}
```

## Dev Agent Record

<!-- Agent will fill this -->
