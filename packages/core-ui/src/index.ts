// Foundations
export { cn } from './lib/cn';
export type { ClassValue } from './lib/cn';
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
export type { ThemeContextValue, ThemeProviderProps } from './theme/ThemeProvider';

// Controls
export { Button } from './components/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './components/Button';
export { IconButton } from './components/IconButton';
export type { IconButtonProps } from './components/IconButton';
export { Spinner } from './components/Spinner';
export type { SpinnerProps } from './components/Spinner';
export { StatusPill } from './components/StatusPill';
export type { StatusPillProps } from './components/StatusPill';
export { SegmentedControl } from './components/SegmentedControl';
export type { SegmentedControlOption, SegmentedControlProps } from './components/SegmentedControl';
export { ThemeToggle } from './components/ThemeToggle';
export type { ThemeToggleProps } from './components/ThemeToggle';

// Forms
export { controlSkin, Field, invalidSkin } from './components/Field';
export type { FieldProps } from './components/Field';
export { Input, Kbd } from './components/Input';
export type { InputProps } from './components/Input';
export { Textarea } from './components/Textarea';
export type { TextareaProps } from './components/Textarea';
export { Select } from './components/Select';
export type { SelectProps } from './components/Select';
export { Checkbox } from './components/Checkbox';
export type { CheckboxProps } from './components/Checkbox';
export { Radio, RadioGroup } from './components/Radio';
export type { RadioGroupProps, RadioProps } from './components/Radio';
export { Switch } from './components/Switch';
export type { SwitchProps } from './components/Switch';

// Content
export { Tag } from './components/Tag';
export type { TagProps, TagTone } from './components/Tag';
export { Link } from './components/Link';
export type { LinkProps, LinkVariant } from './components/Link';
export { CodeBlock, CodeFlag, CodePrompt } from './components/Code';
export type { CodeBlockProps } from './components/Code';
export { LogoMark, Wordmark } from './components/Logo';
export type { LogoMarkProps, WordmarkProps } from './components/Logo';

// Spec-sheet layout
export { BrandRule, SpecLabel, SpecSection } from './components/SpecSection';
export type { SpecLabelProps, SpecSectionProps } from './components/SpecSection';
export { Swatch } from './components/Swatch';
export type { SwatchProps } from './components/Swatch';

// Icons
export * from './components/Icons';

// The whole system on one page
export { DesignSystemShowcase } from './showcase/DesignSystemShowcase';
export type { DesignSystemShowcaseProps } from './showcase/DesignSystemShowcase';

// Tokens
export {
  colors,
  controlHeights,
  fontHref,
  fonts,
  paletteSwatches,
  radii,
  spacing,
  typeScale,
} from './tokens';
export type { ColorToken, ThemedColor, ThemeName, TypeSpec } from './tokens';
