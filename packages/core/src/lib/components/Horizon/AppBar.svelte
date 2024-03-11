<script lang="ts">
  import '../slider.scss'
  import { get, type Readable } from 'svelte/store'
  import { visorEnabled } from '../../utils/visor'
  import { HorizonsManager, Horizon } from '@horizon/core/src/lib/service/horizon'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let horizon: Readable<Horizon> | null

  $: horizonTint = $horizon?.tint

  let tintVal = 275
  $: tint = `hsl(${tintVal}, 40%, 80%)`
  $: horizonTint && horizonTint.set(tint)

  function onNewHorizon() {
    dispatch('createHorizon')
  }

  function onQuitApp() {
    window.api.quitApp()
  }
</script>

<aside>
  <div>
    <ul>
      <!-- New Horizon -->
      <li>
        <button class="tactile_button" on:click={onNewHorizon}>
          <div class="content">
            <div class="icon">
              <svg
                width="6"
                height="6"
                viewBox="0 0 6 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g style="mix-blend-mode:color-burn">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M3.42857 0.428571C3.42857 0.191878 3.23669 0 3 0C2.76331 0 2.57143 0.191878 2.57143 0.428571V2.57143H0.428571C0.191878 2.57143 0 2.76331 0 3C0 3.23669 0.191878 3.42857 0.428571 3.42857H2.57143V5.57143C2.57143 5.80813 2.76331 6 3 6C3.23669 6 3.42857 5.80813 3.42857 5.57143V3.42857H5.57143C5.80813 3.42857 6 3.23669 6 3C6 2.76331 5.80813 2.57143 5.57143 2.57143H3.42857V0.428571Z"
                    fill="#6D6D6C"
                  />
                </g>
              </svg>
            </div>
            <!--<p class="button__text">command</p>-->
          </div>
        </button>
      </li>
      <!-- Visor -->
      <li>
        <button class="tactile_button" on:click={() => visorEnabled.set(!get(visorEnabled))}>
          <div class="content">
            <div class="icon">
              <svg
                width="6"
                height="6"
                viewBox="0 0 6 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clip-path="url(#clip0_302_3954)">
                  <g style="mix-blend-mode:difference">
                    <path
                      d="M2.46386 2.786C2.46386 3.29815 2.47886 4.00058 2.47458 4.574M2.38372 1.46C2.37944 1.37986 2.36915 1.27143 2.35715 1.15272C2.31686 0.758432 2.02586 0.392432 1.63286 0.338432C1.55763 0.327532 1.48174 0.321805 1.40572 0.321289C1.3297 0.321805 1.25381 0.327532 1.17858 0.338432C0.786007 0.392432 0.50615 0.75886 0.483865 1.15486C0.421722 2.24943 0.328293 3.50258 0.336436 4.574"
                      stroke="#6D6D6C"
                      stroke-width="0.57"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M0.334473 4.59389C0.334473 4.73459 0.362186 4.87392 0.41603 5.00391C0.469875 5.1339 0.548795 5.25201 0.648287 5.3515C0.747778 5.451 0.865892 5.52992 0.995883 5.58376C1.12587 5.6376 1.2652 5.66532 1.4059 5.66532C1.5466 5.66532 1.68593 5.6376 1.81592 5.58376C1.94591 5.52992 2.06402 5.451 2.16352 5.3515C2.26301 5.25201 2.34193 5.1339 2.39577 5.00391C2.44962 4.87392 2.47733 4.73459 2.47733 4.59389C2.47733 4.30973 2.36445 4.03721 2.16352 3.83628C1.96258 3.63534 1.69006 3.52246 1.4059 3.52246C1.12174 3.52246 0.849219 3.63534 0.648287 3.83628C0.447355 4.03721 0.334473 4.30973 0.334473 4.59389Z"
                      stroke="#6D6D6C"
                      stroke-width="0.57"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M3.5488 2.78557C3.5488 3.30072 3.5338 4.00786 3.53851 4.58343M3.62937 1.45957C3.63366 1.37943 3.64351 1.271 3.65551 1.15229C3.6958 0.758003 3.9868 0.392003 4.3798 0.338003C4.45504 0.327247 4.53094 0.321663 4.60694 0.321289C4.68323 0.321289 4.75909 0.327718 4.83409 0.338003C5.22666 0.392003 5.50651 0.758432 5.5288 1.15443C5.59094 2.252 5.6848 3.50986 5.67623 4.583"
                      stroke="#6D6D6C"
                      stroke-width="0.57"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M5.67822 4.59389C5.67822 4.87805 5.56534 5.15057 5.36441 5.3515C5.16348 5.55244 4.89095 5.66532 4.60679 5.66532C4.32263 5.66532 4.05011 5.55244 3.84918 5.3515C3.64825 5.15057 3.53537 4.87805 3.53537 4.59389C3.53537 4.30973 3.64825 4.03721 3.84918 3.83628C4.05011 3.63534 4.32263 3.52246 4.60679 3.52246C4.89095 3.52246 5.16348 3.63534 5.36441 3.83628C5.56534 4.03721 5.67822 4.30973 5.67822 4.59389Z"
                      stroke="#6D6D6C"
                      stroke-width="0.57"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M4.07648 1.81272C3.34534 1.32415 2.65448 1.32415 1.92334 1.81272"
                      stroke="#6D6D6C"
                      stroke-width="0.57"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </g>
                </g>
                <defs>
                  <clipPath id="clip0_302_3954">
                    <rect width="6" height="6" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          </div>
        </button>
      </li>
      <li>
        <button class="tactile_button" on:click={() => dispatch('toggleOasis')}>
          <div class="content">
            <div class="icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 13L10 11"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 12L14 10"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 21V8"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M9.82412 15.9951C8.93843 15.9432 8.12112 15.502 7.59183 14.7899C7.06253 14.0779 6.87555 13.1681 7.08112 12.3051C6.34503 11.6932 5.94535 10.7666 6.00544 9.81135C6.06553 8.85605 6.57816 7.98687 7.38512 7.47207C6.66513 6.193 6.97635 4.58079 8.12069 3.6616C9.26502 2.74241 10.9064 2.78619 12.0001 3.76507C13.094 2.78777 14.7343 2.74485 15.8778 3.6636C17.0213 4.58234 17.3328 6.19329 16.6141 7.47207C17.4216 7.98641 17.9347 8.85558 17.995 9.81105C18.0553 10.7665 17.6555 11.6933 16.9191 12.3051C17.1318 13.1981 16.9239 14.1394 16.3548 14.8597C15.7857 15.5801 14.9181 16.0003 14.0001 16.0001H10.0001L9.82412 15.9951Z"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>
      </li>
    </ul>
  </div>
  <span class="name">{$horizon?.data.name}</span>
  <div>
    <div style="height: 150px">
      <input
        type="range"
        min="0"
        max="365"
        class="skeuo"
        bind:value={tintVal}
        style="rotate: 90deg;  transform-origin: top left;translate: 48px;width: 150px;"
      />
    </div>

    <ul>
      <!--<li>
        <button class="tactile_button">
          <div class="content">
            <div class="icon">
              <svg
                width="5"
                height="6"
                viewBox="0 0 5 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.296746 3.00007C0.335318 2.25735 0.476746 1.28878 0.836746 0.576925C0.863776 0.523552 0.903593 0.477696 0.952648 0.443448C1.0017 0.409199 1.05847 0.387622 1.11789 0.38064C1.49785 0.338764 1.87992 0.319016 2.26217 0.321497C2.63889 0.321497 2.97103 0.349354 3.22817 0.383211C3.48746 0.417497 3.62332 0.687497 3.5196 0.927497L3.1116 1.87464C3.46903 1.8875 3.74803 1.91621 4.00732 1.96893C4.06192 1.97865 4.11335 2.00148 4.15719 2.03545C4.20103 2.06942 4.23597 2.11352 4.25903 2.16396C4.28208 2.21441 4.29255 2.26969 4.28954 2.32507C4.28653 2.38045 4.27013 2.43428 4.24175 2.48193C3.78746 3.26621 2.71603 4.55793 1.16632 5.67864C1.16632 4.84078 1.31332 4.26435 1.57132 3.42864H0.714175C0.658169 3.42951 0.602576 3.41893 0.550803 3.39755C0.49903 3.37617 0.452167 3.34445 0.413085 3.30433C0.374004 3.2642 0.343526 3.21652 0.323522 3.1642C0.303517 3.11188 0.294406 3.05603 0.296746 3.00007Z"
                  stroke="#6D6D6C"
                  stroke-width="0.57"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>
      </li>-->
      <li>
        <button class="tactile_button" on:click={() => window.api.toggleFullscreen()}>
          <div class="content">
            <div class="icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 4H20V8"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M14 10L20 4"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 20H4V16"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M4 20L10 14"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M16 20H20V16"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M14 14L20 20"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 4H4V8"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M4 4L10 10"
                  stroke="black"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>
      </li>
      <!-- Theme -->
      <!--<li>
        <button class="tactile_button">
          <div class="content">
            <div class="icon">
              <svg
                width="5"
                height="6"
                viewBox="0 0 5 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.98173 2.18182C3.98345 1.8938 3.9178 1.60937 3.79003 1.35123C3.66227 1.0931 3.47592 0.868408 3.24586 0.695106C3.01581 0.521804 2.74842 0.404688 2.46505 0.353109C2.18168 0.30153 1.89018 0.316916 1.61382 0.39804C1.33745 0.479163 1.08388 0.623777 0.873349 0.820335C0.662817 1.01689 0.501157 1.25995 0.401274 1.5301C0.301391 1.80025 0.266052 2.09002 0.298079 2.37626C0.330106 2.66249 0.428612 2.93728 0.585732 3.17868C0.907589 3.67153 1.0983 3.85325 1.0983 4.44039C1.0983 4.49488 1.11992 4.54713 1.1584 4.5857C1.19689 4.62427 1.2491 4.64599 1.30359 4.64611H2.96387C3.01843 4.64611 3.07076 4.62443 3.10934 4.58585C3.14792 4.54727 3.16959 4.49495 3.16959 4.44039C3.16959 3.8391 3.38259 3.66039 3.7023 3.14911C3.88361 2.85895 3.98038 2.52396 3.98173 2.18182Z"
                  fill="#020137"
                />
                <path
                  d="M3.98173 2.18182C3.98345 1.8938 3.9178 1.60937 3.79003 1.35123C3.66227 1.0931 3.47592 0.868408 3.24586 0.695106C3.01581 0.521804 2.74842 0.404688 2.46505 0.353109C2.18168 0.30153 1.89018 0.316916 1.61382 0.39804C1.33745 0.479164 1.08388 0.623777 0.873349 0.820335C0.662817 1.01689 0.501157 1.25995 0.401274 1.5301C0.301391 1.80025 0.266052 2.09002 0.298079 2.37626C0.330106 2.66249 0.428612 2.93728 0.585732 3.17868C0.907589 3.67153 1.0983 3.85325 1.0983 4.44039C1.0983 4.49488 1.11992 4.54713 1.1584 4.5857C1.19689 4.62427 1.2491 4.64599 1.30359 4.64611H2.96387C3.01843 4.64611 3.07076 4.62443 3.10934 4.58585C3.14792 4.54727 3.16959 4.49495 3.16959 4.44039C3.16959 3.8391 3.38259 3.66039 3.7023 3.14911C3.88361 2.85895 3.98038 2.52396 3.98173 2.18182Z"
                  stroke="#6D6D6C"
                  stroke-width="0.57"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M1.57031 5.67773H2.69746"
                  stroke="#6D6D6C"
                  stroke-width="0.57"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>
      </li>-->
      <!-- Turbo Mode -->
      <!--<li>
        <button class="tactile_button">
          <div class="content">
            <div class="icon">
              <svg
                width="5"
                height="6"
                viewBox="0 0 5 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M0.296746 3.00007C0.335318 2.25735 0.476746 1.28878 0.836746 0.576925C0.863776 0.523552 0.903593 0.477696 0.952648 0.443448C1.0017 0.409199 1.05847 0.387622 1.11789 0.38064C1.49785 0.338764 1.87992 0.319016 2.26217 0.321497C2.63889 0.321497 2.97103 0.349354 3.22817 0.383211C3.48746 0.417497 3.62332 0.687497 3.5196 0.927497L3.1116 1.87464C3.46903 1.8875 3.74803 1.91621 4.00732 1.96893C4.06192 1.97865 4.11335 2.00148 4.15719 2.03545C4.20103 2.06942 4.23597 2.11352 4.25903 2.16396C4.28208 2.21441 4.29255 2.26969 4.28954 2.32507C4.28653 2.38045 4.27013 2.43428 4.24175 2.48193C3.78746 3.26621 2.71603 4.55793 1.16632 5.67864C1.16632 4.84078 1.31332 4.26435 1.57132 3.42864H0.714175C0.658169 3.42951 0.602576 3.41893 0.550803 3.39755C0.49903 3.37617 0.452167 3.34445 0.413085 3.30433C0.374004 3.2642 0.343526 3.21652 0.323522 3.1642C0.303517 3.11188 0.294406 3.05603 0.296746 3.00007Z"
                  stroke="#6D6D6C"
                  stroke-width="0.57"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </button>
      </li>-->
      <!-- Power Button -->
      <li>
        <button class="tactile_button" on:click={onQuitApp}>
          <div class="content">
            <div class="icon">
              <svg
                width="6"
                height="6"
                viewBox="0 0 6 6"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g style="mix-blend-mode:difference">
                  <path
                    d="M3 1.28516V1.49944"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M0.214355 3H0.428641"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M0.7523 4.24902L0.600586 4.40074"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M0.75224 1.75285L0.600098 1.60156"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M3 0.213867V0.428153"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M3 2.35645V2.57073"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M1.71456 5.22461L1.60742 5.41018"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M5.78557 3H5.57129"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M5.24805 4.24902L5.39976 4.40074"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M5.24805 1.75285L5.39976 1.60156"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M4.28564 5.22461L4.39279 5.41018"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                  <path
                    d="M3 5.57129V5.78557"
                    stroke="#6D6D6C"
                    stroke-width="0.57"
                    stroke-linecap="round"
                  />
                </g>
              </svg>
            </div>
            <!--<p class="button__text">command</p>-->
          </div>
        </button>
      </li>
    </ul>
  </div>
</aside>

<style lagn="scss">
  aside {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 70px;
    z-index: 500;
    padding-block: 10px;
    padding-inline: 10px;
    backdrop-filter: blur(9px);
    background: #132411;
    background: #586e84;
    background-color: #f4f5f6;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;

    & > div {
      border-radius: 13px;
      width: 100%;
      height: fit-content;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 5px;

      border: 0.5px solid rgba(90, 87, 57, 0.08);
      background: #d4d3ce;
      box-shadow:
        1px 1px 3px 0px rgba(255, 255, 255, 0.35) inset,
        -2px -2px 2px 0px rgba(0, 0, 0, 0.05) inset;

      & > ul {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        gap: 4px;
      }
    }

    & .name {
      font-size: 0.95em;
      transform: rotate(-90deg);
      text-align: center;
      opacity: 70%;
      text-wrap: nowrap;
      user-select: none;
    }
  }
  ul,
  ol {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tactile_button {
    --size: 100%;
    --radius: 10px;
    position: relative;

    padding: 0;
    width: var(--size);
    height: auto;
    aspect-ratio: 1/1;

    border: 1px solid #cdc4b3;
    outline: none;
    background-color: #f4f5f6;
    border-radius: var(--radius);
    /* box-shadow:
      -6px -20px 35px #666,
      -6px -10px 15px #444,
      -20px 0px 30px #333,
      6px 20px 25px rgba(0, 0, 0, 0.2); */
    transition: 0.13s ease-in-out;
    cursor: pointer;
    &:active {
      box-shadow: none;
      & .content {
        box-shadow: none;
        & .text,
        .icon {
          transform: translate3d(0px, 0px, 0px);
        }
      }
    }
    & .content {
      position: relative;
      display: grid;
      background: #ede9e3;

      padding: 2px;
      width: 100%;
      height: 100%;

      display: flex;
      justify-content: center;
      align-items: center;
      /* grid-template-columns: 1fr 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr; */

      box-shadow:
        inset 0px -3px 0px #ddd,
        0px -3px 0px #f4f5f6;
      border-radius: calc(var(--radius) - 3px);
      transition: 0.13s ease-in-out;

      z-index: 1;
    }
    & .icon {
      position: relative;
      display: flex;

      transform: translate3d(0px, -4px, 0px);
      /* grid-column: 4;*/
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      transition: 0.13s ease-in-out;
      & > svg {
        width: 22px;
        height: 22px;
        /* fill: #aaaaaa; */
      }
    }
    &__text {
      position: relative;

      transform: translate3d(0px, -4px, 0px);
      margin: 0;
      align-self: end;
      grid-column: 1/5;
      grid-row: 2;

      text-align: center;
      font-size: 32px;
      background-color: #888888;
      color: transparent;
      text-shadow: 2px 2px 3px rgba(255, 255, 255, 0.5);
      -webkit-background-clip: text;
      -moz-background-clip: text;
      background-clip: text;
      transition: 0.13s ease-in-out;
    }
  }

  /* .tactile_button {
    position: relative;

    padding: 0;
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;

    border: 2px solid #888888;
    outline: none;
    background-color: #f4f5f6;
    border-radius: 10px;
    box-shadow:
      -6px -20px 35px #ffffff,
      -6px -10px 15px #ffffff,
      -20px 0px 30px #ffffff,
      6px 20px 25px rgba(0, 0, 0, 0.2);
    transition: 0.13s ease-in-out;
    cursor: pointer;
    &:active {
      box-shadow: none;
      &.button__content {
        box-shadow: none;
        &.button__text,
        .button__icon {
          transform: translate3d(0px, 0px, 0px);
        }
      }
    }
    &__content {
      position: relative;
      display: grid;

      padding: 10px;
      width: 100%;
      height: 100%;

      grid-template-columns: 1fr 1fr 1fr 1fr;
      grid-template-rows: 1fr 1fr;

      box-shadow:
        inset 0px -8px 0px #dddddd,
        0px -8px 0px #aaabad;
      border-radius: 10px;
      transition: 0.13s ease-in-out;

      z-index: 1;
    }
    &__icon {
      position: relative;
      display: flex;

      transform: translate3d(0px, -4px, 0px);
      grid-column: 4;
      align-self: start;
      justify-self: end;
      width: 32px;
      height: 32px;
      transition: 0.13s ease-in-out;
      & svg {
        width: 32px;
        height: 32px;
        fill: #aaaaaa;
      }
    }
    &__text {
      position: relative;

      transform: translate3d(0px, -4px, 0px);
      margin: 0;
      align-self: end;
      grid-column: 1/5;
      grid-row: 2;

      text-align: center;
      font-size: 32px;
      background-color: #888888;
      color: transparent;
      text-shadow: 2px 2px 3px rgba(255, 255, 255, 0.5);
      -webkit-background-clip: text;
      -moz-background-clip: text;
      background-clip: text;
      transition: 0.13s ease-in-out;
    }
  } */
</style>
