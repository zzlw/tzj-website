// @tzj/ui — 统一导出入口

// Theme
export { ThemeProvider, useTheme } from "./theme/ThemeProvider";

// Utils
export { cn } from "./lib/utils";

// Components — Button
export {
  Button,
  buttonVariants,
  type ButtonProps,
} from "./components/button";

// Components — Card
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card";

// Components — Badge
export { Badge, badgeVariants, type BadgeProps } from "./components/badge";

// Components — Dialog
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogOverlay,
  DialogClose,
} from "./components/dialog";

// Components — Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./components/table";

// Components — DataTable
export {
  DataTable,
  type Column,
  type DataTableColumn,
  type DataTableProps,
  type DataTableSort,
  type SortOrder,
} from "./components/data-table";

// Components — Separator
export { Separator } from "./components/separator";

// Components — Skeleton
export { Skeleton } from "./components/skeleton";

// Components — Spinner
export { Spinner, spinnerVariants, type SpinnerProps } from "./components/spinner";

// Components — Loading
export { Loading, type LoadingProps } from "./components/loading";

// Components — AlertDialog
export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./components/alert-dialog";

// Components — ConfirmDialog
export { ConfirmDialog, type ConfirmDialogProps } from "./components/confirm-dialog";

// Components — SimpleDialog
export { SimpleDialog, type SimpleDialogProps } from "./components/simple-dialog";

// Components — PageHeader
export { PageHeader, type PageHeaderProps } from "./components/page-header";

// Components — KeyValueList
export {
  KeyValueList,
  type KeyValueListProps,
  type KeyValuePair,
} from "./components/key-value-list";

// Components — StringList
export { StringList, type StringListProps } from "./components/string-list";

// Components — Avatar
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar";

// Components — Collapsible
export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./components/collapsible";

// Components — Sidebar（shadcn）
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./components/sidebar";

// Hooks
export { useIsMobile } from "./hooks/use-mobile";

// Components — Slider
export { Slider } from "./components/slider";

// Components — AudioPlayer（react-use-audio-player + shadcn 控件）
export {
  AudioPlayer,
  AudioPlayerProvider,
  useAudioPlayer,
  useAudioPlayerContext,
  type AudioPlayerProps,
  type AudioPlayerController,
  type AudioLoadOptions,
} from "./components/audio-player";

// Components — Input
export { Input, type InputProps } from "./components/input";

// Components — Textarea
export { Textarea, type TextareaProps } from "./components/textarea";

// Components — Form / Label
export { Label, FieldDescription } from "./components/form";

// Components — Tabs
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs";

// Components — Sheet
export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetOverlay,
  sheetVariants,
} from "./components/sheet";

// Components — Alert
export { Alert, type AlertProps } from "./components/alert";

// Components — Popover
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "./components/popover";

// Components — Switch
export { Switch } from "./components/switch";

// Components — ScrollArea
export { ScrollArea, ScrollBar } from "./components/scroll-area";

// Components — Select
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/select";

// Components — Calendar / DatePicker / DateTimePicker
export { Calendar, type CalendarProps } from "./components/calendar";
export { DatePicker, type DatePickerProps } from "./components/date-picker";
export {
  DateRangePicker,
  type DateRangePickerProps,
} from "./components/date-range-picker";
export {
  DateTimePicker,
  type DateTimePickerProps,
} from "./components/date-time-picker";

// Components — Pagination（shadcn 原语 + 表格分页器）
export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  buildPageItems,
  TablePagination,
  type TablePaginationProps,
} from "./components/pagination";

// Components — Tooltip
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/tooltip";

// Components — HoverCard
export {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./components/hover-card";

// Components — DropdownMenu
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} from "./components/dropdown-menu";
