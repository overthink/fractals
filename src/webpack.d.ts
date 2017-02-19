// Allow imports from the file-loader webpack loader
declare module "file-loader*" {
    const content: string;
    export default content;
}
