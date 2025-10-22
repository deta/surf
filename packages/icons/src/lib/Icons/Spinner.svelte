<svg
  {...$$restProps}
  class="spinner"
  xmlns="http://www.w3.org/2000/svg"
  fill="none"
  viewBox="0 0 24 24"
>
  <circle class="circle" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
  <path
    class="path"
    fill="currentColor"
    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
  />
</svg>

<style lang="css">
  .spinner {
    animation: spin 1s linear infinite;
    /* Add any additional styles for the spinner here */
  }

  .spinner .circle {
    opacity: 0.25;
    /* Add any additional styles for the circle here */
  }

  .spinner .path {
    opacity: 0.75;
    fill: currentColor;
    /* Add any additional styles for the path here */
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
