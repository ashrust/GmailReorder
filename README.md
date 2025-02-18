# Gmail Inbox Reordering Extension

A minimal Firefox extension that visually reorders your Gmail inbox by star color, then by timestamp, without breaking Gmail's built-in click handlers.

## Features

1. **Star Color Priority**  
   - Sorts by star color in the order: None, Purple, Red, Yellow.  
   - If an email is **unread**, it's treated as though unstarred (None).

2. **Time-Based Sorting**  
   - Within each star color group, emails are sorted by the newest (most recent timestamp) first.

3. **Preserves Click Functionality**  
   - Uses a Flex layout approach to reorder emails **visually**, so clicking a row still opens the correct message.

4. **Lightweight**  
   - Minimal JavaScript, minimal overhead.

5. **GPT Powered**
   - Code was written by ChatGPT, not me