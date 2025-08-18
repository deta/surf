<script lang="ts">
  let count = $state(0)

  function handleClick() {
    console.log('Button clicked in Test overlay')
    count += 1
  }
</script>

<div class="wrapper">
  <h1>Test Overlay</h1>
  <button on:click={handleClick}>Click Me</button>
  <p>Button clicked {count} times</p>
</div>

<style lang="scss">
  .wrapper {
    padding: 20px;
    background-color: #f2f2f2;
    border-radius: 8px;
    border: 1px solid #ccc;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  h1 {
    color: #333;
  }

  button {
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background-color: #0056b3;
    }
  }
</style>
