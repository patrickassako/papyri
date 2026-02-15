# Story 10.6: Dashboard Statistiques Admin

Status: ready-for-dev

## Story

As a administrateur,
I want consulter un dashboard complet avec les KPIs de la plateforme,
So that je puisse piloter l'activite du produit.

## Acceptance Criteria

1. **AC1 — KPIs affiches** : Given un admin sur Dashboard, When il consulte, Then il voit : lectures (nombre, duree, contenus populaires), ecoutes (nombre, duree, contenus populaires), abonnes actifs, revenus (MRR, total), retention (J7/J30/J90)
2. **AC2 — Mise a jour quotidienne** : Given les statistiques, When elles sont affichees, Then elles sont mises a jour quotidiennement
3. **AC3 — Source Supabase** : Given les metriques, When elles sont calculees, Then elles proviennent de Supabase (source de verite)
4. **AC4 — Coherence GA** : Given les metriques, When comparees, Then elles sont coherentes avec Google Analytics
5. **AC5 — Page d'accueil** : Given un admin qui se connecte, When il accede au back-office, Then le dashboard est la page d'accueil

## Tasks / Subtasks

- [ ] **Task 1 : Service statistiques** (AC: #1, #2, #3)
  - [ ] 1.1 Creer `backend/src/services/stats.service.js`
  - [ ] 1.2 Fonction `getSubscriptionStats()` : total actifs, MRR, churn
  - [ ] 1.3 Fonction `getContentStats()` : lectures, ecoutes, duree, top 10
  - [ ] 1.4 Fonction `getRetentionStats()` : J7/J30/J90
  - [ ] 1.5 Cache Redis 24h

- [ ] **Task 2 : Dashboard AdminJS** (AC: #1, #5)
  - [ ] 2.1 Page dashboard custom (React component)
  - [ ] 2.2 Widgets : Cards KPIs + Graphiques (Chart.js)
  - [ ] 2.3 Route `/admin` affiche dashboard par defaut

- [ ] **Task 3 : Tests** (AC: #1, #2, #3, #4)
  - [ ] 3.1 Test calcul MRR correct
  - [ ] 3.2 Test retention J7/J30/J90
  - [ ] 3.3 Test top 10 contenus

## Dev Notes

### Service Stats

```javascript
async function getSubscriptionStats() {
  const { data: activeSubscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, price_eur')
    .eq('status', 'active');

  const mrr = activeSubscriptions
    .filter(s => s.plan === 'monthly')
    .reduce((sum, s) => sum + s.price_eur, 0);

  return {
    total_active: activeSubscriptions.length,
    mrr,
    arr: mrr * 12,
  };
}
```

## Dev Agent Record

<!-- Agent will fill this -->
