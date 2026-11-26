// Иконки — единый набор lucide-react (stroke, currentColor), тёмная тема
import {
  ArrowLeft,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Heart,
  Search,
  Home,
  RadioTower,
  History,
  Settings,
  Library,
  ListMusic,
  Volume2,
  Repeat,
  Shuffle,
  Plus,
  X,
  List,
  Download,
  ExternalLink,
  RefreshCw,
  MicVocal,
  ThumbsDown,
  CircleAlert,
  Music,
  MoreVertical,
  Trash2,
  Moon,
  Clock,
  Sliders,
  ChevronDown,
  ChevronUp,
  Check,
  Smile,
  Zap,
  Droplet,
  Loader2,
  Info,
  Phone,
  Bug,
  Code,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

type P = LucideProps

export const IconPlay = (p: P) => <Play {...p} />
export const IconPause = (p: P) => <Pause {...p} />
export const IconNext = (p: P) => <SkipForward {...p} />
export const IconPrev = (p: P) => <SkipBack {...p} />
export const IconHeart = (p: P) => <Heart {...p} />
export const IconHeartFilled = (p: P) => <Heart {...p} fill="currentColor" />
export const IconSearch = (p: P) => <Search {...p} />
export const IconHome = (p: P) => <Home {...p} />
export const IconRadio = (p: P) => <RadioTower {...p} />
export const IconHistory = (p: P) => <History {...p} />
export const IconSettings = (p: P) => <Settings {...p} />
/** «Похожие треки» — полка библиотеки */
export const IconSimilar = (p: P) => <Library {...p} />
export const IconQueue = (p: P) => <ListMusic {...p} />
export const IconVolume = (p: P) => <Volume2 {...p} />
export const IconRepeat = (p: P) => <Repeat {...p} />
export const IconShuffle = (p: P) => <Shuffle {...p} />
export const IconPlus = (p: P) => <Plus {...p} />
export const IconX = (p: P) => <X {...p} />
export const IconList = (p: P) => <List {...p} />
export const IconDownload = (p: P) => <Download {...p} />
export const IconExternal = (p: P) => <ExternalLink {...p} />
export const IconRefresh = (p: P) => <RefreshCw {...p} />
export const IconLyrics = (p: P) => <MicVocal {...p} />
export const IconDislike = (p: P) => <ThumbsDown {...p} />
/** Предупреждение/ошибка */
export const IconError = (p: P) => <CircleAlert {...p} />
/** Нотка (пустое состояние, например нет текста песни) */
export const IconMusicNote = (p: P) => <Music {...p} />
export const IconMore = (p: P) => <MoreVertical {...p} />
export const IconTrash = (p: P) => <Trash2 {...p} />
export const IconMoon = (p: P) => <Moon {...p} />
export const IconClock = (p: P) => <Clock {...p} />
export const IconSliders = (p: P) => <Sliders {...p} />
export const IconBack = (p: P) => <ArrowLeft {...p} />
export const IconChevronDown = (p: P) => <ChevronDown {...p} />
export const IconChevronUp = (p: P) => <ChevronUp {...p} />
/** Галочка (выбранный пункт меню) */
export const IconCheck = (p: P) => <Check {...p} />
export const IconSmile = (p: P) => <Smile {...p} />
export const IconZap = (p: P) => <Zap {...p} />
export const IconDroplet = (p: P) => <Droplet {...p} />
export const IconSpinner = (p: P) => <Loader2 className="spin-icon" {...p} />
/** Таймер сна — луна с часовой стрелкой (заглушка до кастомного SVG) */
export const IconSleepTimer = (p: P) => <Moon {...p} />
export const IconInfo = (p: P) => <Info {...p} />
export const IconPhone = (p: P) => <Phone {...p} />
export const IconBug = (p: P) => <Bug {...p} />
export const IconCode = (p: P) => <Code {...p} />