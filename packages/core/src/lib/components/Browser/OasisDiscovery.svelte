<script lang="ts">
  import { Icon } from '@horizon/icons'

  let apiBase = 'http://localhost:8000/api/v1/admin/collections/chromadb/embedchain_store/topics'

  let ldaResults: HTMLIFrameElement
  let numTopics = 10
  let ldaLoading = false
  let ldaDone = false

  let bertResults: HTMLIFrameElement
  let minimumTopicsBert = 3
  let bertLoading = false
  let topNWordsBert = 3
  let bertDone = false

  const handleLdaSubmit = async (e: Event) => {
    e.preventDefault()
    ldaLoading = true
    try {
      const res = await fetch(`${apiBase}/lda?num_topics=${numTopics}`)
      const data = await res.text()
      ldaResults.srcdoc = data
      ldaDone = true
    } catch (error) {
      const msg = `Error fetching LDA results: ${error}`
      console.error(msg)
      ldaResults.srcdoc = msg
      ldaDone = true
    } finally {
      ldaLoading = false
    }
  }

  const handleBertSubmit = async (e: Event) => {
    e.preventDefault()
    bertLoading = true
    try {
      const res = await fetch(
        `${apiBase}/bertopic?num_topics=${minimumTopicsBert}&top_n_words=${topNWordsBert}`
      )
      const data = await res.text()
      bertResults.srcdoc = data
      bertDone = true
    } catch (error) {
      const msg = `Error fetching BerTopic results: ${error}`
      console.error(msg)
      bertResults.srcdoc = msg
      bertDone = true
    } finally {
      bertLoading = false
    }
  }
</script>

<!-- TODO: go to documents from topics -->

<div class="wrapper">
  <div class="content">
    <h1>Oasis Discovery</h1>
    <div class="backends">
      <div class="berttopic">
        <h2>BerTopic</h2>
        <br />
        <form on:submit={handleBertSubmit}>
          <div>
            <label for="slider-bert-a">Minimum number of topics:</label>
            <input
              bind:value={minimumTopicsBert}
              type="range"
              id="slider-bert-a"
              min="2"
              max="20"
            />
            <span>{minimumTopicsBert}</span>
          </div>
          <div>
            <label for="slider-bert-b">Top N Words:</label>
            <input bind:value={topNWordsBert} type="range" id="slider-bert-b" min="1" max="20" />
            <span>{topNWordsBert}</span>
          </div>
          <button type="submit">Run BertTopic</button>
        </form>
        <br />
        <div class="results">
          {#if bertLoading}
            <Icon name="spinner" size="20px" />
          {/if}
          <iframe
            bind:this={bertResults}
            title="BerTopic Results"
            style="display: {bertDone ? 'block' : 'none'}"
          />
          <br />
          {#if bertDone}
            <button on:click={() => (bertDone = false)}>Close</button>
          {/if}
        </div>
      </div>
      <br />
      <div class="lda">
        <h2>Latent Dirichlet Allocation (LDA)</h2>
        <br />
        <form on:submit={handleLdaSubmit}>
          <div>
            <label for="slider-lda">Number of topics:</label>
            <input bind:value={numTopics} type="range" id="slider-lda" min="1" max="20" />
            <span>{numTopics}</span>
          </div>
          <button type="submit">Run LDA</button>
        </form>
        <br />
        <div class="results">
          {#if ldaLoading}
            <Icon name="spinner" size="20px" />
          {/if}
          <iframe
            bind:this={ldaResults}
            title="LDA Results"
            style="display: {ldaDone ? 'block' : 'none'}"
          />
          <br />
          {#if ldaDone}
            <button on:click={() => (ldaDone = false)}>Close</button>
          {/if}
        </div>
      </div>
      <br />
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    padding-top: 5rem;
    display: flex;
    justify-content: center;
    background-color: white;
    overflow: auto;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    width: 90%;
    margin: 1rem;
  }

  .backends {
    display: flex;
    flex-direction: column;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    width: 100px;
  }

  iframe {
    width: 100%;
    height: 800px;
    border: none;
  }
</style>
