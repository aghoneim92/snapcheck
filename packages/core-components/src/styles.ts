// Build entry for the compiled stylesheet. Importing the CSS from `index.ts`
// would force every consumer to take the styles; keeping it on its own entry
// means `@snapcheck/core-components/styles.css` stays opt-in.
import './styles.css';
