export namespace Cat {
  export type Image = {
    id: string;
    url: string;
    width: number;
    height: number;
  };

  export type Response = Image[];
}
