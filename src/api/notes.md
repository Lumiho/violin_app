# Button + API Connection Pattern

## The Flow

1. **HTML** - Create the button element with an `id`
   ```html
   <button id="ask-btn">Ask Coach</button>
   <div id="ask-response"></div>
   ```

2. **JS** - Grab a reference to that element using the `id`
   ```typescript
   const askBtn = getElement<HTMLButtonElement>('ask-btn');
   const askResponse = getElement<HTMLDivElement>('ask-response');
   ```

3. **JS** - Attach a function to its `onclick` event
   ```typescript
   askBtn.onclick = async () => {
     // this runs when clicked
   };
   ```

## Full Example (Ask Coach Button)

```typescript
const askBtn = getElement<HTMLButtonElement>('ask-btn');
const askResponse = getElement<HTMLDivElement>('ask-response');

askBtn.onclick = async () => {
  askBtn.disabled = true;              // prevent double-clicks
  askBtn.textContent = 'Thinking...';
  askResponse.textContent = '';        // clear previous response

  try {
    const response = await ask();      // call the API
    askResponse.textContent = response;
  } catch (err) {
    askResponse.textContent = 'Error getting response.';
  }

  askBtn.disabled = false;
  askBtn.textContent = 'Ask Coach';
};
```

## Fetch Syntax

```typescript
const response = await fetch('/api/ask', {
  method: 'POST',                                 // required for sending data
  headers: { 'Content-Type': 'application/json' }, // tells server it's JSON
  body: JSON.stringify({ ... })                   // the data to send
});
```

## Key Concepts

- `onclick` - runs the function when button is clicked
- `async/await` - lets you wait for the API response (fetch takes time)
- `try/catch` - handles errors (server down, network issues, etc.)
- `.textContent` - sets the text inside an element
- `.disabled` - prevents clicking the button

## Pattern Summary

**Create it in HTML → Reference it in JS → Attach behavior**
