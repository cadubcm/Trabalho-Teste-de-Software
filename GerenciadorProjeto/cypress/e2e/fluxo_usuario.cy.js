describe("Fluxo usuário - E2E", () => {
  const baseUrl = "http://127.0.0.1:5500/index.html";

  it("Deve fazer login, criar post-it, deletar post-it e logout", () => {
    cy.visit(baseUrl);

    // Login
    cy.get("#username").type("usuarioTeste");
    cy.get("#password").type("senhaTeste");
    cy.contains("Entrar").click();

    // Verificar que o quadro foi exibido
    cy.get("#board-page").should("be.visible");

    // Criar post-it
    cy.get("#color-select").select("yellow");
    cy.contains("Adicionar Post-it").click();

    // Verificar que um post-it foi criado
    cy.get(".postit").should("have.length", 1);

    // Deletar post-it
    cy.get(".delete-btn").click();

    // Verificar que não tem post-it
    cy.get(".postit").should("have.length", 0);

    // Logout
    cy.contains("Logout").click();

    // Verificar que voltou para tela de login
    cy.get("#login-page").should("be.visible");
  });
});
