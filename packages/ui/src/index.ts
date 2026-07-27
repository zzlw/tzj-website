// @tzj/ui — 统一导出入口

// Components — Alert
export { Alert, type AlertProps } from './components/alert';
// Components — AudioPlayer（react-use-audio-player + shadcn 控件）
export {
  AudioPlayer,
  type AudioPlayerProps,
} from './components/audio-player';
// Components — Avatar
export { Avatar, AvatarFallback, AvatarImage } from './components/avatar';

// Components — Badge
export { Badge, type BadgeProps } from './components/badge';
// Components — Button
export {
  Button,
  type ButtonProps,
} from './components/button';
// Components — Card
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/card';
// Components — Collapsible
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './components/collapsible';
// Components — ConfirmDialog
export { ConfirmDialog, type ConfirmDialogProps } from './components/confirm-dialog';
// Components — ContentList（知识库浏览列表）
export {
  ContentList,
  ContentListItem,
  type ContentListItemProps,
  type ContentListProps,
  ContentListSectionHeader,
  type ContentListSectionHeaderProps,
  ContentListSkeleton,
  type ContentListSkeletonProps,
} from './components/content-list';
// Components — DataTable
export {
  type Column,
  DataTable,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  type SortOrder,
} from './components/data-table';
export { DatePicker, type DatePickerProps } from './components/date-picker';
export {
  DateRangePicker,
  type DateRangePickerProps,
} from './components/date-range-picker';
export {
  DateTimePicker,
  type DateTimePickerProps,
} from './components/date-time-picker';
// Components — Dialog
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
// Components — DropdownMenu
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/dropdown-menu';
// Components — EmptyState
export { EmptyState, type EmptyStateProps } from './components/empty-state';
// Components — Form / Label
export { FieldDescription, Label } from './components/form';
// Components — HoverCard
export {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './components/hover-card';
export { ImagePreview } from './components/image-preview/ImagePreview';
// Components — ImagePreview（react-photo-view 统一封装：灯箱 Provider + 触发器）
export { ImagePreviewProvider } from './components/image-preview/ImagePreviewProvider';
// Components — Input
export { Input, type InputProps } from './components/input';
// Components — KeyValueList
export {
  KeyValueList,
  type KeyValueListProps,
  type KeyValuePair,
} from './components/key-value-list';
// Components — ListToolbar
export { ListToolbar, type ListToolbarProps } from './components/list-toolbar';
// Components — Loading
export { Loading, type LoadingProps } from './components/loading';
// Components — MarkdownBody（react-markdown 引擎，CMS 正文；基础映射 + 图片组件可注入）
export {
  MarkdownBody,
  type MarkdownComponents,
  markdownBaseComponents,
} from './components/markdown/MarkdownBody';
// Components — MarkdownPreview（Vditor.preview 统一渲染，含 chat 变体）
export {
  MarkdownPreview,
  type MarkdownPreviewVariant,
} from './components/markdown/MarkdownPreview';
// Components — PageHeader
export { PageHeader, type PageHeaderProps } from './components/page-header';
// Components — Pagination（表格分页器）
export {
  TablePagination,
  type TablePaginationProps,
} from './components/pagination';
// Components — Popover
export {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './components/popover';
// Components — ScrollArea
export { ScrollArea } from './components/scroll-area';
// Components — Select
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/select';
// Components — Separator
export { Separator } from './components/separator';
// Components — Sheet
export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './components/sheet';
// Components — Sidebar（shadcn）
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './components/sidebar';
// Components — SimpleDialog
export { SimpleDialog, type SimpleDialogProps } from './components/simple-dialog';
// Components — Skeleton
export { Skeleton } from './components/skeleton';
// Components — Slider
export { Slider } from './components/slider';
// Components — StringList
export { StringList, type StringListProps } from './components/string-list';
// Components — Switch
export { Switch } from './components/switch';
// Components — Table
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/table';
// Components — Tabs
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
// Components — Tag
export {
  TagChip,
  type TagChipProps,
  TagFilterBar,
  type TagFilterBarProps,
  type TagFilterItem,
  TagsInput,
  type TagsInputProps,
} from './components/tag';
// Components — Textarea
export { Textarea, type TextareaProps } from './components/textarea';
// Components — Toast（sonner / shadcn 风格）
export { Toaster, type ToastOptions, toast } from './components/toast';
// Components — Tooltip
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/tooltip';
// Utils
export { cn } from './lib/utils';
// Theme
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
