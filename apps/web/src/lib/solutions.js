Object.defineProperty(exports, '__esModule', { value: true });
exports.solutions = exports.SOLUTION_META = void 0;
exports.getAllSolutionSlugs = getAllSolutionSlugs;
exports.getSolutionBySlug = getSolutionBySlug;
const lucide_react_1 = require('lucide-react');
exports.SOLUTION_META = [
  {
    slug: 'fire-rescue',
    icon: lucide_react_1.Flame,
    image: '/media/tower-wylie.jpg',
    caseHref: '/cases/henan-fire-rescue',
    focusIcons: [
      lucide_react_1.Flame,
      lucide_react_1.Building2,
      lucide_react_1.Beaker,
      lucide_react_1.ClipboardCheck,
    ],
    recommendedHrefs: ['/fixed-tower', '/burn-rooms', '/burn-rooms/cfbt', '/accessories/hazmat'],
  },
  {
    slug: 'police',
    icon: lucide_react_1.Shield,
    image: '/media/tower-hamilton.jpg',
    caseHref: '/cases/shandong-police',
    focusIcons: [
      lucide_react_1.Building2,
      lucide_react_1.Target,
      lucide_react_1.Shield,
      lucide_react_1.Users,
    ],
    recommendedHrefs: [
      '/fixed-tower/climbing-tower',
      '/accessories/tactical',
      '/fixed-tower/custom',
      '/accessories/fitness-equipment',
    ],
  },
  {
    slug: 'military',
    icon: lucide_react_1.Target,
    image: '/media/tower-titusville.jpg',
    focusIcons: [
      lucide_react_1.Dumbbell,
      lucide_react_1.Brain,
      lucide_react_1.Mountain,
      lucide_react_1.Layers,
    ],
    recommendedHrefs: [
      '/fixed-tower',
      '/specialized-training/psychological',
      '/specialized-training/rope-rescue',
      '/accessories/fitness-equipment',
    ],
  },
  {
    slug: 'mine-rescue',
    icon: lucide_react_1.Mountain,
    image: '/media/tower-eastside.jpg',
    caseHref: '/cases/shanxi-mine-rescue',
    focusIcons: [
      lucide_react_1.Layers,
      lucide_react_1.Flame,
      lucide_react_1.Mountain,
      lucide_react_1.ClipboardCheck,
    ],
    recommendedHrefs: [
      '/modular-tower',
      '/specialized-training/rope-rescue',
      '/burn-rooms',
      '/accessories/hazmat',
    ],
  },
  {
    slug: 'education',
    icon: lucide_react_1.GraduationCap,
    image: '/media/tower-macon.jpg',
    caseHref: '/cases/jiangsu-university',
    focusIcons: [
      lucide_react_1.GraduationCap,
      lucide_react_1.Building2,
      lucide_react_1.Users,
      lucide_react_1.ClipboardCheck,
    ],
    recommendedHrefs: [
      '/education-center',
      '/fixed-tower/series',
      '/modular-tower',
      '/burn-rooms/fire-simulation',
    ],
  },
  {
    slug: 'enterprise',
    icon: lucide_react_1.Factory,
    image: '/media/tower-chino.jpg',
    caseHref: '/cases/guangdong-cfbt',
    focusIcons: [
      lucide_react_1.Beaker,
      lucide_react_1.Flame,
      lucide_react_1.Trophy,
      lucide_react_1.ClipboardCheck,
    ],
    recommendedHrefs: [
      '/accessories/hazmat',
      '/burn-rooms/fire-simulation',
      '/accessories/competition',
      '/modular-tower',
    ],
  },
];
exports.solutions = [];
function getAllSolutionSlugs() {
  return exports.SOLUTION_META.map((s) => s.slug);
}
function getSolutionBySlug(_slug) {
  return undefined;
}
//# sourceMappingURL=solutions.js.map
