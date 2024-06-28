<script lang="ts">
  import { writable } from 'svelte/store'
  import { Icon } from '@horizon/icons'
  import type { Resource, ResourceManager } from '../../service/resources'
  import * as d3 from 'd3'
  import { useLogScope } from '../../utils/log'
  import MiniBrowser from '@horizon/core/src/lib/components/Browser/MiniBrowser.svelte'
  import ResourcePreviewClean from '../Resources/ResourcePreviewClean.svelte'

  export let resourceManager: ResourceManager

  let apiBase = 'http://localhost:8000/api/v1/admin/collections/chromadb/embedchain_store/topics'

  const plotMargin = { top: 20, right: 30, bottom: 30, left: 40 }
  const plotWidth = 2200 - plotMargin.left - plotMargin.right
  const axisWidth = 1400
  const plotHeight = 1400 - plotMargin.top - plotMargin.bottom
  const plotColorScale = d3.scaleOrdinal(d3.schemeCategory10)

  const log = useLogScope('OasisDiscovery')

  let ldaResults: HTMLIFrameElement
  let numTopics = 10
  let ldaLoading = false
  let ldaDone = false

  let bertResults: SVGSVGElement
  let minimumTopicsBert = 3
  let exactTopicsBert: number | undefined
  let bertLoading = false
  let topNWordsBert = 10
  let probThresholdBert = 0.3
  let topicsHint = ''
  let bertData: any[] = []
  let bertDone = false

  let hoverPreviewTop: number
  let hoverPreviewLeft: number
  let hoveredTopic: string
  let hoveredResource = writable<Resource | undefined>(undefined)
  let clickedResource = writable<Resource | undefined>(undefined)

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

  const stringToColor = (str: string) => {
    let hash = 2166136261
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = (hash * 16777619) >>> 0 // Ensure 32-bit unsigned integer
    }
    const color = (hash & 0xffffff).toString(16).padStart(6, '0')
    return `#${color}`
  }

  const createBertPlot = async () => {
    const xScale = d3
      .scaleLinear()
      //.domain([-1, 1])
      .domain([d3.min(bertData, (d: any) => d.x) - 4, d3.max(bertData, (d: any) => d.x) + 4])
      .range([0, axisWidth])
      .clamp(true)

    const yScale = d3
      .scaleLinear()
      //.domain([-1, 1])
      .domain([d3.min(bertData, (d: any) => d.y) - 4, d3.max(bertData, (d: any) => d.y) + 4])
      .range([plotHeight, 0])
      .clamp(true)

    // Create SVG
    let svg = d3
      .select('.bertResults')
      .attr('width', plotWidth + plotMargin.left + plotMargin.right)
      .attr('height', plotHeight + plotMargin.top + plotMargin.bottom)
      .append('g')
      .attr('transform', `translate(${plotMargin.left},${plotMargin.top})`)

    // Create X and Y axes
    let xAxis = svg
      .append('g')
      .attr('transform', `translate(0,${plotHeight / 2})`)
      .call(d3.axisBottom(xScale))
    let yAxis = svg
      .append('g')
      .attr('transform', `translate(${axisWidth / 2},0)`)
      .call(d3.axisLeft(yScale))

    // brush to zoom in
    const brushGroup = svg.append('g')

    // Create dots
    let dots = svg
      .selectAll('dot')
      .data(bertData)
      .enter()
      .append('circle')
      .attr('cx', (d: any) => xScale(d.x))
      .attr('cy', (d: any) => yScale(d.y))
      .attr('r', 5)
      .attr('class', (d: any) => `topic-${d.topic_id}`)
      .style('fill', (d: any) => stringToColor(d.name))
      .style('cursor', 'pointer')

    svg
      .selectAll('circle')
      .on('mouseover', async function (event: any, d: any) {
        hoverPreviewTop = event.pageY
        hoverPreviewLeft = event.pageX + 20
        hoveredTopic = d.name
        const resource = await resourceManager.getResource(d.resource_id)
        if (!resource) {
          log.error('Resource with id ${d.resource_id} not found')
          alert('Resource not found')
          return
        }
        hoveredResource.set(resource)
      })
      .on('mouseout', function () {
        hoveredResource.set(undefined)
      })
      .on('click', async function (event: any, d: any) {
        const resource = await resourceManager.getResource(d.resource_id)
        if (!resource) {
          log.error('Resource with id ${d.resource_id} not found')
          alert('Resource not found')
          return
        }
        clickedResource.set(resource)
      })

    let topicsSet: any[] = []
    let seenTopics = new Set()
    for (const d of bertData) {
      if (!seenTopics.has(d.topic_id)) {
        topicsSet.push({ topic_id: d.topic_id, name: d.name })
        seenTopics.add(d.topic_id)
      }
    }

    let legend = svg
      .selectAll('.legend')
      .data(topicsSet)
      .enter()
      .append('g')
      .attr('class', 'legend')
      .attr('transform', function (d, i) {
        return 'translate(0,' + i * 20 + ')'
      })
      .style('cursor', 'pointer')
      .on('click', function (event: any, topic: any) {
        const text = d3.select(this).select('text')
        const fontWeight = text.style('font-weight')
        if (fontWeight === 'bold') {
          text.style('font-weight', 'normal')
        } else {
          text.style('font-weight', 'bold')
        }

        const topicPoints = svg.selectAll(`circle.topic-${topic.topic_id}`)
        if (topicPoints.classed('hidden')) {
          topicPoints.style('visibility', 'visible')
          topicPoints.classed('hidden', false)
        }
        const filteredPoints = svg.selectAll(`circle:not(.topic-${topic.topic_id})`)
        if (filteredPoints.classed('hidden')) {
          filteredPoints.style('visibility', 'visible')
          filteredPoints.classed('hidden', false)
        } else {
          filteredPoints.style('visibility', 'hidden')
          filteredPoints.classed('hidden', true)
        }
      })

    legend
      .append('rect')
      .attr('x', axisWidth + 20)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', (topic: any) => stringToColor(topic.name))

    legend
      .append('text')
      .attr('x', axisWidth + 43) // rect x + rect width + 5
      .attr('y', 9)
      .attr('dy', '.35em')
      .attr('class', 'legend-item')
      .style('font-weight', 'normal')
      .text(function (topic: any) {
        return topic.name
      })

    const brushed = (event: any) => {
      if (!event.selection) {
        return
      }

      // Get the new domain based on the brush selection
      const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]]
      xScale.domain([xScale.invert(x0), xScale.invert(x1)])
      yScale.domain([yScale.invert(y1), yScale.invert(y0)])

      // Update the scatter plot
      xAxis.transition().duration(1000).call(d3.axisBottom(xScale))
      yAxis.transition().duration(1000).call(d3.axisLeft(yScale))

      // Update scatter plot points
      dots.attr('cx', (d: any) => xScale(d.x)).attr('cy', (d: any) => yScale(d.y))

      // Reset the brush
      brushGroup.call(brush.move, null)
    }
    // Create the brush
    const brush = d3
      .brush()
      .extent([
        [0, 0],
        [axisWidth, plotHeight]
      ])
      .on('end', brushed)

    brushGroup.call(brush)

    // Add double-click to reset zoom
    svg.on('dblclick', function () {
      xScale.domain([d3.min(bertData, (d: any) => d.x) - 4, d3.max(bertData, (d: any) => d.x) + 4])
      yScale.domain([d3.min(bertData, (d: any) => d.y) - 4, d3.max(bertData, (d: any) => d.y) + 4])
      xAxis.transition().duration(750).call(d3.axisBottom(xScale))
      yAxis.transition().duration(750).call(d3.axisLeft(yScale))
      dots.attr('cx', (d: any) => xScale(d.x)).attr('cy', (d: any) => yScale(d.y))
    })
  }

  const handleBertSubmit = async (e: Event) => {
    e.preventDefault()
    bertLoading = true
    bertResults.innerHTML = ''
    try {
      // mockData
      /*
      bertData = [
        {
          doc_id: 0,
          topic_id: 0,
          name: 'topic 0',
          probability: 1,
          x: 0.5,
          y: 0.5,
          resource_id: '81f31b15-6a9e-4064-ada7-f9dc6d772689'
        },
        {
          doc_id: 1,
          topic_id: 1,
          name: 'topic 1',
          probability: 1,
          x: -0.5,
          y: -0.5,
          resource_id: '81f31b15-6a9e-4064-ada7-f9dc6d772689'
        },
        {
          doc_id: 2,
          topic_id: 0,
          name: 'topic 0',
          probability: 1,
          x: 0.25,
          y: 0.25,
          resource_id: '81f31b15-6a9e-4064-ada7-f9dc6d772689'
        }
      ]
      */
      let url = `${apiBase}/bertopic?num_topics=${minimumTopicsBert}&top_n_words=${topNWordsBert}&prob_threshold=${probThresholdBert}`
      if (exactTopicsBert && exactTopicsBert >= 2) {
        exactTopicsBert = Math.floor(exactTopicsBert) + 1 // add 1 for outlier topic
        url += `&nr_topics=${exactTopicsBert}`
      }
      if (topicsHint) {
        url += `&topics_hint=${topicsHint}`
      }
      const res = await fetch(url)
      bertData = await res.json()
      bertDone = true
      createBertPlot()
    } catch (error) {
      const msg = `Error fetching BerTopic results: ${error}`
      log.error(msg)
      bertDone = true
    } finally {
      bertLoading = false
    }
  }
</script>

<div class="wrapper">
  {#if $clickedResource}
    <div class="overlay">
      <MiniBrowser
        resource={clickedResource}
        on:close={() => clickedResource.set(undefined)}
        {resourceManager}
      />
    </div>
  {/if}
  {#if $hoveredResource}
    <div class="overlay-hover" style="top: {hoverPreviewTop}px; left: {hoverPreviewLeft}px;">
      <p>{hoveredTopic}</p>
      <br />
      <ResourcePreviewClean resource={$hoveredResource} />
    </div>
  {/if}
  <div class="content">
    <h1>Oasis Discovery</h1>
    <div class="backends">
      <div class="berttopic">
        <h2>BerTopic</h2>
        <br />
        <form on:submit={handleBertSubmit}>
          <!--div>
            <label for="slider-bert-a">Minimum number of topics:</label>
            <input
              bind:value={minimumTopicsBert}
              type="range"
              id="slider-bert-a"
              min="2"
              max="20"
            />
            <span>{minimumTopicsBert}</span>
          </div-->
          <div>
            <label for="slider-bert-b">Top N Words:</label>
            <input bind:value={topNWordsBert} type="range" id="slider-bert-b" min="1" max="20" />
            <span>{topNWordsBert}</span>
          </div>
          <div>
            <label for="slider-bert-c">Probability threshold:</label>
            <input
              bind:value={probThresholdBert}
              type="range"
              id="slider-bert-c"
              min="0.1"
              max="1.0"
              step="0.05"
            />
            <span>{probThresholdBert}</span>
          </div>
          <div>
            <label for="number-bert-a">Exact Number of Topics:</label>
            <input bind:value={exactTopicsBert} type="number" id="number-bert-a" min="2" />
          </div>
          <div style="display:flex;">
            <label for="topics-bert">Topics Hint:</label>
            <textarea bind:value={topicsHint} id="topics-bert" cols="100" />
          </div>
          <button type="submit">Run BertTopic</button>
        </form>
        <br />
        <div class="results">
          {#if bertLoading}
            <!--Icon name="spinner" size="20px" /-->
            <p>Loading...</p>
          {/if}
          <svg
            bind:this={bertResults}
            class="bertResults"
            style="display: {bertDone ? 'block' : 'none'}"
          />
          <br />
          {#if bertDone}
            <button on:click={() => ((bertResults.innerHTML = ''), (bertDone = false))}
              >Close</button
            >
          {/if}
        </div>
      </div>
      <br />
      <!-- div class="lda">
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
      <br /-->
    </div>
  </div>
</div>

<style lang="scss">
  .wrapper {
    width: 100%;
    height: 100%;
    padding-top: 1rem;
    display: flex;
    justify-content: center;
    background-color: white;
    overflow: auto;
  }

  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 90%;
    margin: 1rem;
    overflow: auto;
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
    height: 1350px;
    border: none;
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .overlay-hover {
    position: fixed;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 998;
    max-width: 500px;
    max-height: 450px;
  }
</style>
