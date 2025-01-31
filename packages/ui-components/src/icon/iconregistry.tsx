// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import React from 'react';
import { classes } from 'typestyle/lib';

import { Text } from '@jupyterlab/coreutils';

import { IIconRegistry, Icon } from './interfaces';
import { IconImports } from './iconimports';
import { iconStyle, iconStyleFlat } from '../style/icon';

import badSvg from '../../style/debug/bad.svg';
import blankSvg from '../../style/debug/blank.svg';

/**
 * The icon registry class.
 */
export class IconRegistry implements IIconRegistry {
  constructor(options: IconRegistry.IOptions = {}) {
    this._debug = !!options.debug;

    let icons = options.initialIcons || IconImports.defaultIcons;
    this.addIcon(...icons);

    // add the bad state and blank icons
    this.addIcon(
      { name: 'bad', svg: badSvg },
      { name: 'blank', svg: blankSvg }
    );
  }

  addIcon(...icons: Icon.IModel[]): void {
    icons.forEach((icon: Icon.IModel) => {
      let className = icon.className
        ? icon.className
        : IconRegistry.iconClassName(icon.name);
      this._classNameToName[className] = icon.name;
      this._nameToClassName[icon.name] = className;
      this._svg[icon.name] = icon.svg;
    });
  }

  contains(name: string): boolean {
    return !!this._resolveName(name);
  }

  /**
   * Get the icon as an HTMLElement of tag <svg><svg/>
   */
  icon(
    props: Icon.INodeOptions & { container?: HTMLElement }
  ): HTMLElement | null {
    const {
      name,
      className,
      title,
      fallback,
      container,
      ...propsStyle
    } = props;

    // we may have been handed a className in place of name
    let resolvedName = this.resolveName(name);
    if (!resolvedName) {
      // TODO: remove fallback in jlab 2.0
      if (fallback) {
        if (container) {
          container.textContent = title || '';
          container.className = classes(
            name,
            className,
            propsStyle ? iconStyleFlat(propsStyle) : ''
          );
          return container;
        } else {
          // the non-container fallback isn't implemented
          console.error('unimplemented');
          return null;
        }
      }

      // bail if failing silently
      return null;
    }

    // check if icon element is already set
    if (
      container &&
      container.dataset.icon &&
      container.dataset.icon === resolvedName &&
      container.children[0]
    ) {
      // return the existing icon element
      return container.children[0] as HTMLElement;
    }

    // ensure that svg html is valid
    const svgElement = this.resolveSvg(resolvedName);
    if (!svgElement) {
      // bail if failing silently
      return null;
    }

    if (title) {
      Private.setTitleSvg(svgElement, title);
    }

    if (container) {
      // clear any existing icon in container (and all other child elements)
      container.textContent = '';
      container.dataset.icon = resolvedName;
      container.appendChild(svgElement);

      let styleClass = propsStyle ? iconStyle(propsStyle) : '';
      if (className || className === '') {
        // override the className, if explicitly passed
        container.className = classes(className, styleClass);
      } else if (!container.classList.contains(styleClass)) {
        // add icon styling class to the container's class, if not already present
        container.className = classes(container.className, styleClass);
      }
    } else {
      // add icon styling class directly to the svg node
      svgElement.setAttribute(
        'class',
        classes(className, propsStyle ? iconStyleFlat(propsStyle) : '')
      );
    }

    return svgElement;
  }

  /**
   * Get the icon as a ReactElement of tag <tag><svg><svg/><tag/>
   * TODO: figure out how to remove the unnecessary outer <tag>
   */
  iconReact(
    props: Icon.INodeOptions & { tag?: 'div' | 'span' }
  ): React.ReactElement {
    const { name, className, title, fallback, tag, ...propsStyle } = props;
    const Tag = tag || 'div';

    // we may have been handed a className in place of name
    const resolvedName = this.resolveName(name);
    if (!resolvedName) {
      // TODO: remove fallback in jlab 2.0
      if (fallback) {
        return (
          <Tag
            className={classes(
              name,
              className,
              propsStyle ? iconStyleFlat(propsStyle) : ''
            )}
          >
            {title || ''}
          </Tag>
        );
      }

      // bail if failing silently
      return <></>;
    }

    // ensure that svg html is valid
    const svgElement = this.resolveSvg(resolvedName);
    if (!svgElement) {
      // bail if failing silently
      return <></>;
    }

    if (title) {
      Private.setTitleSvg(svgElement, title);
    }

    return (
      <Tag
        className={classes(className, propsStyle ? iconStyle(propsStyle) : '')}
        data-icon={resolvedName}
        dangerouslySetInnerHTML={{
          __html: svgElement.outerHTML
        }}
      />
    );
  }

  private _resolveName(name: string): string {
    if (!(name in this._svg)) {
      // skip resolution if name is not defined
      if (name) {
        // assume name is really a className, split the className into parts and check each part
        for (let className of name.split(/\s+/)) {
          if (className in this._classNameToName) {
            return this._classNameToName[className];
          }
        }
      }

      // couldn't resolve name, fail silently
      return '';
    }

    return name;
  }

  resolveName(name: string): string {
    const resolvedName = this._resolveName(name);
    if (!resolvedName) {
      if (this._debug) {
        // couldn't resolve name, mark as bad and warn
        console.error(`Invalid icon name: ${name}`);
        return 'bad';
      } else {
        // couldn't resolve name, fail silently
        return '';
      }
    }

    return resolvedName;
  }

  resolveSvg(name: string): HTMLElement | null {
    let svgHtml = this.svg(name);

    // workaround for 1.0.x versions of Jlab pulling in 1.1.x versions of ui-components
    // TODO: delete workaround in v2.0.0
    const bprefix = 'data:image/svg+xml;base64,';
    if (svgHtml.startsWith(bprefix)) {
      // slice off the prefix and covert base64 to string
      svgHtml = atob(svgHtml.slice(bprefix.length));
    }

    const parser = new DOMParser();
    const svgElement = parser.parseFromString(svgHtml, 'image/svg+xml')
      .documentElement;

    if (svgElement.getElementsByTagName('parsererror').length > 0) {
      const errmsg = `SVG HTML was malformed for icon name: ${name}`;
      // parse failed, svgElement will be an error box
      if (this._debug) {
        // fail noisily, render the error box
        console.error(errmsg);
        return svgElement;
      } else {
        // bad svg is always a real error, fail silently but warn
        console.warn(errmsg);
        return null;
      }
    } else {
      // parse succeeded
      return svgElement;
    }
  }

  svg(name: string): string {
    return this._svg[name];
  }

  static iconClassName(name: string): string {
    return 'jp-' + Text.camelCase(name, true) + 'Icon';
  }

  private _classNameToName: { [key: string]: string } = Object.create(null);
  private _debug: boolean = false;
  private _nameToClassName: { [key: string]: string } = Object.create(null);
  private _svg: { [key: string]: string } = Object.create(null);
}

/**
 * The defaultIconRegistry instance.
 */
export const defaultIconRegistry: IconRegistry = new IconRegistry();

/**
 * Alias for defaultIconRegistry.iconReact that can be used as a React component
 */
export const DefaultIconReact = (
  props: Icon.INodeOptions & { tag?: 'div' | 'span' }
): React.ReactElement => {
  return defaultIconRegistry.iconReact(props);
};

export namespace IconRegistry {
  /**
   * The options used to create an icon registry.
   */
  export interface IOptions {
    /**
     * The initial icons for the registry.
     * The [[Icon.defaultIcons]] will be used if not given.
     */
    initialIcons?: Icon.IModel[];

    /**
     * If the debug flag is set, missing icons will raise a warning
     * and be visually marked with an "X". Otherwise, missing icons
     * will fail silently.
     */
    debug?: boolean;
  }
}

namespace Private {
  export function setTitleSvg(svgNode: HTMLElement, title: string): void {
    // add a title node to the top level svg node
    let titleNodes = svgNode.getElementsByTagName('title');
    if (titleNodes.length) {
      titleNodes[0].textContent = title;
    } else {
      let titleNode = document.createElement('title');
      titleNode.textContent = title;
      svgNode.appendChild(titleNode);
    }
  }
}
