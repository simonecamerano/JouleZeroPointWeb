import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import HomeView from '../views/HomeView.vue';

type AuthState = {
  isLoggedIn: boolean;
  isAdmin: boolean;
};

type RouteMetaLike = {
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
};

type RouteLike = {
  fullPath: string;
  meta: RouteMetaLike;
};

export function resolveAuthRedirect( to: RouteLike, authState: AuthState ) {
  if ( to.meta.requiresAdmin ) {
    if ( !authState.isLoggedIn ) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    if ( !authState.isAdmin ) {
      return { name: 'home' };
    }
  } else if ( to.meta.requiresAuth && !authState.isLoggedIn ) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  return null;
}

const router = createRouter( {
  history: createWebHistory( import.meta.env.BASE_URL ),
  scrollBehavior() {
    return { top: 0, behavior: 'smooth' };
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/starter-decks/:id',
      name: 'starter-deck-detail',
      component: () => import( '../views/StarterDeckDetailView.vue' )
    },
    {
      path: '/cards',
      name: 'cards',
      component: () => import( '../views/CardsView.vue' )
    },
    {
      path: '/come-iniziare',
      name: 'getting-started',
      component: () => import( '../views/GettingStartedView.vue' )
    },
    {
      path: '/regolamento',
      name: 'rules',
      component: () => import( '../views/RulesView.vue' )
    },
    {
      path: '/login',
      name: 'login',
      component: () => import( '../views/LoginView.vue' )
    },
    {
      path: '/register',
      name: 'register',
      component: () => import( '../views/LoginView.vue' ),
      beforeEnter: ( to, _from, next ) => {
        to.query.mode = 'register';
        next();
      }
    },
    {
      path: '/deckbuilder',
      name: 'deckbuilder',
      component: () => import( '../views/DeckbuilderView.vue' ),
      meta: { requiresAuth: true }
    },
    {
      path: '/partita',
      name: 'partita',
      component: () => import( '../views/MatchView.vue' ),
      meta: { requiresAuth: true }
    },
    {
      path: '/partita/:codice',
      name: 'partita-codice',
      component: () => import( '../views/MatchView.vue' ),
      meta: { requiresAuth: true }
    },
    {
      path: '/public-decks',
      name: 'public-decks',
      component: () => import( '../views/PublicDecksView.vue' )
    },
    {
      path: '/news',
      name: 'news-archive',
      component: () => import( '../views/NewsArchiveView.vue' )
    },
    {
      path: '/storia',
      name: 'storia-archive',
      redirect: { path: '/news', query: { category: 'storia' } }
    },
    {
      path: '/news/:slug',
      name: 'news-detail',
      component: () => import( '../views/NewsDetailView.vue' )
    },
    {
      path: '/terminale-punto-zero',
      name: 'terminal',
      component: () => import( '../views/TerminalView.vue' ),
      meta: { hideUI: true }
    },
    {
      path: '/admin/news',
      name: 'admin-news',
      component: () => import( '../views/AdminNewsView.vue' ),
      meta: { hideUI: true, requiresAdmin: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import( '../views/ProfileView.vue' ),
      meta: { requiresAuth: true }
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import( '../views/TermsView.vue' )
    },
    {
      path: '/code-of-conduct',
      name: 'conduct',
      component: () => import( '../views/ConductView.vue' )
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import( '../views/PrivacyView.vue' )
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import( '../views/ContactView.vue' )
    },
    {
      path: '/verify-email/:token',
      name: 'verifyEmail',
      component: () => import( '../views/VerifyEmailView.vue' )
    },
    {
      path: '/forgot-password',
      name: 'forgotPassword',
      component: () => import( '../views/ForgotPasswordView.vue' )
    },
    {
      path: '/reset-password/:token',
      name: 'resetPassword',
      component: () => import( '../views/ResetPasswordView.vue' )
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import( '../views/NotFoundView.vue' )
    }
  ]
} )

router.beforeEach( ( to, _from, next ) => {
  const authStore = useAuthStore();
  const redirect = resolveAuthRedirect( to, {
    isLoggedIn: authStore.isLoggedIn,
    isAdmin: authStore.isAdmin,
  } );

  if ( redirect ) {
    next( redirect );
  } else {
    next();
  }
} );

export default router
