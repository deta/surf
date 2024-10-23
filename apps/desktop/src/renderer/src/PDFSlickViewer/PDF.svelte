<script>
  const urlParams = new URLSearchParams(window.location.search)
  const path = decodeURIComponent(urlParams.get('path'))
</script>

<h1>{path}</h1>

<style>
  h1 {
    color: #ff3e00;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 2em;
  }
</style>
