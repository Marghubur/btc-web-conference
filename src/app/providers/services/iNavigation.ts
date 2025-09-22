import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { CommonService } from "./common.service";

const NAVPARAMNAME = "navigation_parameter";
@Injectable({
  providedIn: 'root' 
})
export class iNavigation {
  private pageRoute: PageRouteDetail = null;
  private IsNavigated: boolean = false;

  constructor(private route: Router, private common: CommonService) {
    this.pageRoute = new PageRouteDetail();
    if (sessionStorage.getItem(NAVPARAMNAME)) {
      this.IsNavigated = true;
        this.pageRoute = JSON.parse(sessionStorage.getItem(NAVPARAMNAME));
    }
  }

  public clearNavigation() {
    this.pageRoute = new PageRouteDetail();
  }

  public pushRoute(route: string, value: string = null, filter: Filter = null) {
    if(this.IsNavigated) {
      this.IsNavigated = false;
      return;
    }

    if(this.pageRoute.PageName === route) {
      let elem = this.pageRoute.RouteDetail.find(x => x.Key === route);
      if(elem) {
        this.popRoutes(route);
      } else {
        this.pageRoute.RouteDetail.push({
          Key: route,
          Value: value,
          PageQuery: filter
        });
      }
    } else {
      this.pageRoute.PageName = route;
      this.pageRoute.RouteDetail = [];
      this.pageRoute.RouteDetail.push({
        Key: route,
        Value: value,
        PageQuery: filter
      });
    }

    this.IsNavigated = false;
    sessionStorage.setItem(NAVPARAMNAME, JSON.stringify(this.pageRoute));
  }

  public pushNavRoute(route: string, value: string = null, filter: Filter = null) {
    let elem = this.pageRoute.RouteDetail.find(x => x.Key === route);
    if(elem) {
      this.popRoutes(route);
    } else {
      this.pageRoute.RouteDetail.push({
        Key: route,
        Value: value,
        PageQuery: filter
      });
      this.pageRoute.PageName = route;
    }

    sessionStorage.setItem(NAVPARAMNAME, JSON.stringify(this.pageRoute));
  }

  public popRoutes(route: string) {
    let i = 0;
    let newRouteData = [];
    while(i < this.pageRoute.RouteDetail.length) {
      if(this.pageRoute.RouteDetail[i].Key === route) {
        newRouteData.push(this.pageRoute.RouteDetail[i]);
        break;
      }
      newRouteData.push(this.pageRoute.RouteDetail[i]);
      i++;
    }

    this.pageRoute.RouteDetail = newRouteData;
  }

  public getRoute(route: string) {
    return this.pageRoute.RouteDetail.find(x => x.Key === route);
  }

  public getTopRoute() {
    return this.pageRoute.PageName;
  }

  public getRouteList() {
    return this.pageRoute.RouteDetail;
  }

  public navigate(Path: string, Parameter: any, filterObject: any = null) {
    if (Path !== null) {
      this.IsNavigated = true;
      this.pushNavRoute(Path, Parameter, filterObject);
      this.route.navigate(["/" + Path, ]);
    } else {
      console.error("Invalid component path passed.");
    }
  }

  public navigateRoot(Path: string, Parameter: any, filterObject: any = null) {
    if (Path !== null) {
      if (Path != this.common.GetCurrentPageName())
        this.common.isLoading.next(true);

      this.IsNavigated = true;
      this.pageRoute.RouteDetail = [];
      this.pushNavRoute(Path, Parameter, filterObject);
      this.route.navigate(["/" + Path, ]);
    } else {
      console.error("Invalid component path passed.");
    }
  }

  public navigateWithoutArgs(Path: string) {
    if (Path !== null) {
      this.pageRoute.PageName = Path;
      this.route.navigate(["/" + Path, ]);
    } else {
      console.error("Invalid component path passed.");
    }
  }

  public navigateWithArgs(Path: string, args: string, Parameter: any = null, filterObject: any = null) {
    if (Path !== null) {
      this.IsNavigated = true;
      this.pushNavRoute(Path, Parameter, filterObject);
      this.route.navigate(["/" + Path], { queryParams: { path: args } });
    } else {
      console.error("Invalid component path passed.");
    }
  }

  public manageLocalSessionKey(pageName: string) {
    let key = localStorage.getItem(NAVPARAMNAME);
    let path = pageName.split("?");
    if (path[0] != key) {
      if (key !== "") {
        localStorage.removeItem(key);
      }
    }
  }

  public getValue(): any {
    let ParsedData = null;
    let path = this.common.GetCurrentPageName().split("?");
    let Data: any = sessionStorage.getItem(NAVPARAMNAME);
    if (Data && path.length > 0) {
      try {
        this.pageRoute = JSON.parse(Data);
        let currentRoute = this.pageRoute.RouteDetail.find(x => x.Key === path[0]);
        if(currentRoute) {
          ParsedData = currentRoute.Value;
        }
      } catch (e) {
        console.log(JSON.stringify(e));
        console.error("Unable to get route data. Please contact admin.");
      }
    }
    return ParsedData;
  }

  public setValue(value: any): any {
    let path = this.common.GetCurrentPageName().split("?");
    let Data: any = sessionStorage.getItem(NAVPARAMNAME);
    if (Data && path.length > 0) {
      try {
        let pageRoute = JSON.parse(Data);
        let currentRoute = pageRoute.RouteDetail.find(x => x.Key === path[0]);
        if(currentRoute) {
          currentRoute.Value = value;

          let data = JSON.stringify(pageRoute);
          sessionStorage.setItem(NAVPARAMNAME, data);
        }
      } catch (e) {
        console.log(JSON.stringify(e));
        console.error("Unable to get route data. Please contact admin.");
      }
    }
  }

  // public replaceValue(data: any) {
  //   if (data !== null && data !== "") {
  //     //localStorage.setItem(this.common.GetCurrentPageName(), JSON.stringify(data));
  //     sessionStorage.setItem(this.common.GetCurrentPageName(), JSON.stringify(data));
  //   }
  // }

  public resetValue() {
    localStorage.removeItem(this.common.GetCurrentPageName());
  }

  public logout() {
    localStorage.clear();
  }
}

class PageRouteDetail {
  PageName: string = null;
  RouteDetail: Array<any> = [];
}

export function avatarList(radius: number, startWidth: number, lineCount: number = 3) {
  return {
    c: ['d-flex'],
    d: [
      {
        s: `o,${radius}`,
        d: [

        ]
      },
      {
        s: `~,${startWidth}`,
        r: lineCount,
      }
    ]
  };
}

export function gap(value: number) {
  return {
    c: [`mb-${value}`],
    s: '-,0,1',
  };
}

export function placeholderCard(width: number, height: number) {
  return {
    c: ['mb-2'],
    s: `-,${width},${height}`,
  };
}

export function listCard({startWidth, lineCount = 3, isForwardDirection = true, cardWidth = 35, cardHeight = 8, gapSize = 1.5}) {
  let arrayTags = [];

  let i = 0;
  while(i < lineCount) {
    arrayTags.push({
      c: ['mb-2'],
      s: `-,${startWidth}`,
    });

    if(isForwardDirection) {
      startWidth += 2;
    } else {
      startWidth -= 2;
    }

    i++;
  }

  arrayTags.push(gap(gapSize));
  arrayTags.push(placeholderCard(cardWidth, cardHeight));
  return arrayTags;
}

export function list({lineCount , width = 100, height = 1, gapSize = 1.5}) {
  let arrayTags = [];

  let i = 0;
  while(i < lineCount) {
    arrayTags.push({
      c: ['mb-2'],
      s: `-,${width}, ${height}`,
    });

    i++;
  }

  arrayTags.push(gap(gapSize));
  return arrayTags;
}

export function avatar({radius}) {
  return {
    c: ['d-flex'],
    d: [
      {
        s: `o,${radius}`,
        d: [

        ]
      },
    ]
  };
}


export class Filter {
  EmployeeId?: number = 0;
  ClientId?: number = 0;
  SearchString: string = "1=1";
  PageIndex: number = 1;
  StartIndex?: number = 0;
  EndIndex?: number = 0;
  PageSize: number = 10;
  SortBy?: string = "";
  CompanyId: number = 0;
  TotalRecords?: number = 0;
  ShowPageNo?: number = 5;
  ActivePageNumber?: number = 1;
  isReUseSame?: boolean = false;
  isActive?: boolean = true;
  SortDirection?: string = null;
  ForYear?: number = 0;
  ForMonth?: number = 0;

  update(total: any) {
    if(!isNaN(Number(total))) {
      this.TotalRecords = total;
      this.StartIndex = 1;
      this.PageIndex = 1;
    }
  }

  reset() {
    this.TotalRecords = 0;
    this.StartIndex = 1;
    this.PageIndex = 1;
    this.ActivePageNumber = 1;
    this.SortDirection = null;
  }
}