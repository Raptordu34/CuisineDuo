# Guide de Contribution CuisineDuo

Ce document définit les standards de développement pour le projet afin de maintenir un historique propre et une base de code stable.

## 1. Stratégie de Branches

Ne travaillez **jamais** directement sur la branche `main`. Utilisez des branches thématiques :

- `feature/nom-feature` : Pour les nouvelles fonctionnalités.
- `fix/nom-bug` : Pour les corrections de bugs.
- `refactor/nom-refacto` : Pour les améliorations de code sans changement fonctionnel.

### Flux de travail type :
1. Créer une branche : `git checkout -b feature/ma-nouvelle-idee`
2. Faire des commits atomiques (un commit = une petite tâche).
3. Une fois terminé et testé, fusionner dans main :
   ```bash
   git checkout main
   git merge feature/ma-nouvelle-idee
   git branch -d feature/ma-nouvelle-idee
   ```

## 2. Convention de Commit

Nous utilisons le standard **Conventional Commits**.

**Format :** `<type>(<scope>): <description>`

### Types autorisés :
- `feat` : Une nouvelle fonctionnalité.
- `fix` : Correction d'un bug.
- `docs` : Documentation (README, commentaires).
- `style` : Mise en forme, points-virgules manquants (pas de changement de code).
- `refactor` : Modification du code qui ne corrige rien et n'ajoute rien.
- `chore` : Maintenance, mise à jour de dépendances, config.

### Exemples :
- `feat(recipe): ajouter le bouton de partage des recettes`
- `fix(auth): corriger l'expiration du token Supabase`
- `style(ui): alignement du menu sur mobile`

## 3. Qualité du Code
- Un commit ne doit pas dépasser quelques dizaines/centaines de lignes si possible.
- Toujours tester la stabilité avant de fusionner vers `main`.
