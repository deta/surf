<script lang="ts">
  import { SERVICES } from '@horizon/web-parser'
  import paper from '../../../../public/assets/paper.png'
  import { getServiceIcon } from '../../utils/services'

  export let service: string

  $: serviceIconUrl = resolveServiceIcon(service)
  $: serviceTitle = resolveServiceTitle(service)
  $: serviceAction = resolveServiceAction(service)

  const AVAILABLE_SERVICES = SERVICES.filter((e) => e.showBrowserAction === true)

  function resolveServiceIcon(serviceName: string): string {
    const serviceItem = AVAILABLE_SERVICES.find((s) => s.id === serviceName)
    return serviceItem ? getServiceIcon(serviceItem.id) : ''
  }

  function resolveServiceTitle(serviceName: string): string {
    const serviceItem = AVAILABLE_SERVICES.find((s) => s.id === serviceName)
    return serviceItem ? serviceItem.name : 'Unknown Service'
  }

  function resolveServiceAction(serviceName: string): string {
    const serviceItem = AVAILABLE_SERVICES.find((s) => s.id === serviceName)
    return serviceItem ? serviceItem.browserActionTitle! : 'Unknown Action'
  }
</script>

<div class="create-element embla__slide">
  <div class="thumbnail-wrapper">
    <img class="thumbnail-paper" src={paper} alt="Paper background" />
    <img class="thumbnail-service" src={serviceIconUrl} alt={`Service icon for ${service}`} />
    <div class="thumbnail-new">{serviceAction}</div>
  </div>
  <div class="title">
    {serviceTitle}
  </div>
</div>

<style lang="scss">
  @property --innerColor {
    syntax: '<color>';
    initial-value: #fdfdfd;
    inherits: false;
  }

  @property --outerColor {
    syntax: '<color>';
    initial-value: #efefef;
    inherits: false;
  }

  .create-element {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 12rem;
    height: 8rem;
    pointer-events: visible;
    &:hover {
      --innerColor: #fdfdfd;
      --outerColor: #e5e5e5;

      .thumbnail-wrapper {
        .thumbnail-paper {
          transform: translateY(-8px) rotate(3deg);
        }

        .thumbnail-service {
          transform: translateY(-9px) rotate(3deg) translateX(3px);
        }

        .thumbnail-new {
          opacity: 1;
          transform: translateY(-9px) rotate(3deg) translateX(3px);
          filter: drop-shadow(0px 0.5px 0.5px rgba(0, 0, 0, 0.25));
        }
      }
    }

    .thumbnail-wrapper {
      position: relative;
      display: flex;
      justify-content: center;
      width: 100%;
      height: calc(100% - 1rem);
      overflow: hidden;
      background: linear-gradient(var(--innerColor), var(--outerColor));
      stroke-width: 0.5px;
      background-blend-mode: darken;
      border-radius: 8px;
      transition:
        --innerColor 260ms,
        --outerColor 450ms;
      .thumbnail-paper {
        padding-top: 0.5rem;
        height: 200%;
        transition: all 260ms ease-out;
      }

      .thumbnail-service {
        position: absolute;
        top: 2.5rem;
        left: 28%;
        width: 1.5rem;
        height: 1.5rem;
        transition: all 260ms ease-out;
      }

      .thumbnail-new {
        position: absolute;
        top: 5rem;
        left: 22%;
        right: 22%;
        width: fit-content;
        font-size: 0.75rem;
        background: white;
        padding: 0.125rem 0.5rem;
        border-radius: 12px;
        opacity: 0;
        transition: all 260ms ease-out;
        pointer-events: none;
      }
    }

    .title {
      height: 1.2rem;
      opacity: 0.6;
    }
  }

  .embla__slide {
    flex: 0 0 28%;
    min-width: 0;
    margin-right: 20px;
    cursor: pointer;
  }
</style>
